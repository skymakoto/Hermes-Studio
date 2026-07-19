#!/usr/bin/env python3
"""Private account gateway for Hermes Studio clients.

The broker keeps the Hermes API key inside WSL. Clients authenticate with a
per-user password, receive a revocable opaque token, and never see the key.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import ipaddress
import secrets
import time
from pathlib import Path
from typing import Any

from aiohttp import ClientSession, ClientTimeout, web

APP_DIR = Path(os.getenv("HERMES_STUDIO_DATA_DIR", str(Path.home() / ".local" / "share" / "hermes-studio")))
USERS_FILE = APP_DIR / "users.json"
SESSIONS_FILE = APP_DIR / "sessions.json"
CONNECTION_FILE = APP_DIR / "connection.json"
TOKEN_TTL_SECONDS = 2_592_000
MAX_BODY_BYTES = 10 * 1024 * 1024


def read_json(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json_private(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.chmod(temporary, 0o600)
    temporary.replace(path)


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$16384$8$1$" + base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(digest).decode()


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt_text, digest_text = encoded.split("$")
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_text)
        expected = base64.urlsafe_b64decode(digest_text)
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def clean_username(value: Any) -> str:
    username = str(value or "").strip().lower()
    if not 3 <= len(username) <= 32 or not username.replace("_", "").replace("-", "").isalnum():
        raise web.HTTPBadRequest(text=json.dumps({"error": "用户名只能使用 3-32 位字母、数字、下划线或连字符。"}), content_type="application/json")
    return username


def load_connection() -> dict[str, str]:
    config = read_json(CONNECTION_FILE, {})
    api_base_url = str(config.get("apiBaseUrl") or "http://127.0.0.1:8642").rstrip("/")
    api_key = str(config.get("apiKey") or "")
    if not api_key:
        raise RuntimeError("Hermes API connection key is not configured.")
    return {"api_base_url": api_base_url, "api_key": api_key}


def client_identity(request: web.Request) -> str:
    return request.remote or "unknown"


class AccountGateway:
    def __init__(self) -> None:
        self.users = read_json(USERS_FILE, {"users": {}})
        self.sessions: dict[str, dict[str, Any]] = {
            token: record for token, record in read_json(SESSIONS_FILE, {}).items()
            if isinstance(record, dict) and record.get("expires_at", 0) > time.time()
        }
        self.login_attempts: dict[str, list[float]] = {}
        self.client: ClientSession | None = None

    async def start(self, _app: web.Application) -> None:
        self.client = ClientSession(timeout=ClientTimeout(total=None, sock_connect=10, sock_read=None))

    async def close(self, _app: web.Application) -> None:
        if self.client:
            await self.client.close()

    def save_users(self) -> None:
        write_json_private(USERS_FILE, self.users)

    def save_sessions(self) -> None:
        write_json_private(SESSIONS_FILE, self.sessions)

    def rate_limit_login(self, request: web.Request) -> None:
        identity = client_identity(request)
        now = time.time()
        attempts = [item for item in self.login_attempts.get(identity, []) if now - item < 300]
        if len(attempts) >= 8:
            raise web.HTTPTooManyRequests(text=json.dumps({"error": "登录尝试过于频繁，请稍后再试。"}), content_type="application/json")
        attempts.append(now)
        self.login_attempts[identity] = attempts

    def authenticated_user(self, request: web.Request) -> str:
        header = request.headers.get("Authorization", "")
        token = header[7:].strip() if header.startswith("Bearer ") else ""
        record = self.sessions.get(token_hash(token))
        if not record or record["expires_at"] <= time.time():
            if record:
                self.sessions.pop(token_hash(token), None)
                self.save_sessions()
            raise web.HTTPUnauthorized(text=json.dumps({"error": "登录已失效，请重新连接账号。"}), content_type="application/json")
        return record["username"]

    async def health(self, _request: web.Request) -> web.Response:
        return web.json_response({"status": "ok", "service": "hermes-studio-account-gateway"})

    async def register(self, request: web.Request) -> web.Response:
        body = await request.json()
        username = clean_username(body.get("username"))
        password = str(body.get("password") or "")
        setup_code = str(body.get("setupCode") or "")
        users = self.users.setdefault("users", {})
        bootstrap_code = os.getenv("HERMES_STUDIO_SETUP_CODE", "")
        if users and (not bootstrap_code or not hmac.compare_digest(setup_code, bootstrap_code)):
            raise web.HTTPForbidden(text=json.dumps({"error": "需要管理员配对码才能创建新账号。"}), content_type="application/json")
        if username in users:
            raise web.HTTPConflict(text=json.dumps({"error": "该账号已存在。"}), content_type="application/json")
        if len(password) < 10:
            raise web.HTTPBadRequest(text=json.dumps({"error": "密码至少需要 10 个字符。"}), content_type="application/json")
        users[username] = {
            "password_hash": hash_password(password),
            "created_at": int(time.time()),
            "enabled": True,
            "role": "admin" if not users else "member",
        }
        self.save_users()
        return web.json_response({"ok": True, "username": username}, status=201)

    async def login(self, request: web.Request) -> web.Response:
        self.rate_limit_login(request)
        body = await request.json()
        username = clean_username(body.get("username"))
        password = str(body.get("password") or "")
        user = self.users.get("users", {}).get(username)
        if not user or not user.get("enabled") or not verify_password(password, user.get("password_hash", "")):
            raise web.HTTPUnauthorized(text=json.dumps({"error": "账号或密码不正确。"}), content_type="application/json")
        token = secrets.token_urlsafe(48)
        self.sessions[token_hash(token)] = {"username": username, "expires_at": time.time() + TOKEN_TTL_SECONDS}
        self.save_sessions()
        return web.json_response({"token": token, "username": username, "expiresAt": int(time.time() + TOKEN_TTL_SECONDS)})

    async def me(self, request: web.Request) -> web.Response:
        return web.json_response({"username": self.authenticated_user(request)})

    async def logout(self, request: web.Request) -> web.Response:
        header = request.headers.get("Authorization", "")
        token = header[7:].strip() if header.startswith("Bearer ") else ""
        self.sessions.pop(token_hash(token), None)
        self.save_sessions()
        return web.json_response({"ok": True})

    async def proxy(self, request: web.Request) -> web.StreamResponse:
        if self.client is None:
            raise web.HTTPServiceUnavailable(text=json.dumps({"error": "Account gateway is starting."}), content_type="application/json")
        username = self.authenticated_user(request)
        config = load_connection()
        suffix = request.match_info.get("tail", "")
        target = f"{config['api_base_url']}/{suffix}"
        body = await request.read()
        if len(body) > MAX_BODY_BYTES:
            raise web.HTTPRequestEntityTooLarge(max_size=MAX_BODY_BYTES, actual_size=len(body))
        headers = {
            "Authorization": f"Bearer {config['api_key']}",
            "X-Hermes-Session-Key": f"hermes-studio:{username}",
        }
        content_type = request.headers.get("Content-Type")
        if content_type:
            headers["Content-Type"] = content_type
        async with self.client.request(request.method, target, headers=headers, data=body) as upstream:
            response_headers = {key: value for key, value in upstream.headers.items() if key.lower() in {"content-type", "cache-control", "x-accel-buffering", "x-hermes-session-id"}}
            response = web.StreamResponse(status=upstream.status, headers=response_headers)
            await response.prepare(request)
            async for chunk in upstream.content.iter_chunked(8192):
                await response.write(chunk)
            await response.write_eof()
            return response


def create_app() -> web.Application:
    gateway = AccountGateway()
    @web.middleware
    async def trusted_network(request: web.Request, handler: Any) -> web.StreamResponse:
        remote = request.remote or ''
        try:
            address = ipaddress.ip_address(remote)
            if not (address.is_loopback or address in ipaddress.ip_network('100.64.0.0/10')):
                raise web.HTTPForbidden(text=json.dumps({"error": "只允许本机或 Tailscale 设备访问。"}), content_type="application/json")
        except ValueError:
            raise web.HTTPForbidden(text=json.dumps({"error": "无效的客户端地址。"}), content_type="application/json")
        return await handler(request)

    app = web.Application(client_max_size=MAX_BODY_BYTES, middlewares=[trusted_network])
    app.on_startup.append(gateway.start)
    app.on_cleanup.append(gateway.close)
    app.router.add_get("/health", gateway.health)
    app.router.add_post("/auth/register", gateway.register)
    app.router.add_post("/auth/login", gateway.login)
    app.router.add_get("/auth/me", gateway.me)
    app.router.add_post("/auth/logout", gateway.logout)
    app.router.add_route("*", "/hermes/{tail:.*}", gateway.proxy)
    return app


if __name__ == "__main__":
    host = os.getenv("HERMES_STUDIO_ACCOUNT_HOST", "127.0.0.1")
    port = int(os.getenv("HERMES_STUDIO_ACCOUNT_PORT", "8650"))
    web.run_app(create_app(), host=host, port=port, access_log=None)
