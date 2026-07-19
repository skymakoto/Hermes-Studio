# Hermes Studio

[中文说明](README.md)

Hermes Studio is a Windows desktop client for a Hermes Agent instance that you operate yourself on WSL or Linux. The client does not keep the Hermes API key, model-provider credentials, skills, memory, or session database. Those remain on the server host.

> This release is designed for an individual, a small trusted team, or devices on the same Tailscale network. It is not a multi-tenant sandbox and must not be exposed to the public Internet.

## Features

- Native Windows Electron client with streaming responses and tool activity.
- WSL/Linux account gateway. Users sign in with a username and password; the client stores only a Windows DPAPI-protected token.
- The Hermes API key stays on the server. The gateway forwards authenticated requests to the Hermes API.
- Session list, create/select/delete sessions, model selection, file picking, and custom skins.
- Per-account Hermes session namespaces through `X-Hermes-Session-Key`.

## Architecture

```text
Windows Hermes Studio
        |
        | HTTP over localhost or Tailscale
        v
WSL/Linux Account Gateway :8650
        |
        | private Hermes API key
        v
Hermes API Server :8642
```

## Quick Start: Windows Client

1. Download the Windows x64 portable `.exe` from GitHub Releases.
2. Join the Tailscale network operated by the server administrator.
3. Start Studio and enter one of these gateway URLs:
   - Local server: `http://localhost:8650`
   - Remote server: `http://<TAILSCALE_HOST_IP>:8650`
4. Register with the pairing code provided by the administrator, or sign in with an existing account.

A regular client does not need Hermes CLI, Python, Node.js, or an API key.

## Self-Hosted Server

### Prerequisites

- Linux or WSL2. A systemd user service is recommended.
- A working [Hermes Agent](https://hermes-agent.nousresearch.com/docs) installation.
- A local Hermes API server, for example at `http://127.0.0.1:8642`.
- Python 3.11+.
- Tailscale if other devices need access.

### Install

```bash
git clone https://github.com/<YOUR_GITHUB_USER>/hermes-studio.git
cd hermes-studio
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Create private configuration files from the templates. Never commit the resulting real files:

```bash
mkdir -p ~/.config/hermes-studio ~/.local/share/hermes-studio
cp wsl/account-gateway.env.example ~/.config/hermes-studio/account-gateway.env
cp wsl/connection.json.example ~/.local/share/hermes-studio/connection.json
chmod 600 ~/.config/hermes-studio/account-gateway.env ~/.local/share/hermes-studio/connection.json
```

Edit `~/.config/hermes-studio/account-gateway.env`:

- Set `HERMES_STUDIO_SETUP_CODE` to a long, random pairing code.
- Use `HERMES_STUDIO_ACCOUNT_HOST=0.0.0.0` for trusted Tailscale clients.
- Use `127.0.0.1` for a local-only server.

Edit `~/.local/share/hermes-studio/connection.json`:

- `apiBaseUrl`: local Hermes API address.
- `apiKey`: local Hermes API key.

Enable the systemd user service:

```bash
mkdir -p ~/.config/systemd/user
sed "s|%h/hermes-studio|$HOME/hermes-studio|g" \
  wsl/hermes-studio-account.service.example \
  > ~/.config/systemd/user/hermes-studio-account.service
systemctl --user daemon-reload
systemctl --user enable --now hermes-studio-account.service
systemctl --user status hermes-studio-account.service
```

Verify the gateway:

```bash
curl http://127.0.0.1:8650/health
```

## Local Development

```bash
npm ci
npm test
npm start
```

Build for Windows:

```powershell
npm ci
npm run dist:win:portable
```

Artifacts are written to `release/`. Publish stable binaries as GitHub Release assets; do not commit `release/` to Git.

## Security Boundary

- The gateway accepts only localhost and Tailscale CGNAT clients in `100.64.0.0/10`.
- Accounts isolate login tokens, Studio session identity, and scoped memory. They do **not** isolate Hermes terminal or filesystem tool permissions.
- Do not expose port 8650 to the public Internet or distribute pairing codes to untrusted users.
- Never commit `connection.json`, `account-gateway.env`, `users.json`, `sessions.json`, `~/.hermes/`, or any API key.
- See [SECURITY.md](SECURITY.md) for the full security guidance.

## Maintainer Release Checklist

Before committing, run:

```bash
npm test
python3 -m py_compile wsl/account_gateway.py
```

Use a Windows GitHub Actions runner to build portable artifacts and create a GitHub Release from a tag. Keep only source, configuration templates, and documentation in the repository; upload binaries as release assets.

## License

Released under the [MIT License](LICENSE).
