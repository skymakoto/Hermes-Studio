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

### Keep WSL Alive After Closing Ubuntu

`systemd --user` linger keeps user services alive only while the WSL instance itself is running. It does not prevent Windows from reclaiming the whole WSL VM after its last WSL client exits. If Studio becomes unavailable after closing the Ubuntu window, retain a Windows-side reference to the Ubuntu instance as well.

#### Confirmed Incident Review

The observed symptom was that, after the last Ubuntu/CLI window closed, Studio login reported `TypeError: fetch failed` or that it could not connect to the Studio service; it recovered after WSL was started again. During investigation, `hermes-gateway.service`, `hermes-studio-account.service`, ports `8642`/`8650`, the authenticated account-gateway-to-Hermes-API health request, and Windows access to `localhost:8650` were all healthy. The root cause was therefore not the Studio gateway URL, account service, or Hermes Gateway configuration. Windows had reclaimed the WSL instance after its final WSL client exited, so the local services were no longer running.

Closing an extra WSL child process is not a valid test while the original Ubuntu/CLI window remains open: the WSL instance has not entered the real "last client exited" state. The acceptance test is to close the final Ubuntu window, then verify the health endpoint from Windows and confirm that the Windows-side keepalive `wsl.exe` process still exists.

1. Confirm `/etc/wsl.conf` contains:

```ini
[boot]
systemd=true
```

2. In WSL, enable the services and user linger:

```bash
loginctl enable-linger "$USER"
systemctl --user enable --now hermes-gateway.service hermes-studio-account.service
```

An optional in-guest keepalive unit may also be enabled if you have created one, but it is not a replacement for the Windows-side process in the next step.

3. Start this hidden, long-running command through a Windows sign-in startup item or Scheduled Task. Do not replace it with a one-shot `systemctl start` command:

```powershell
wsl.exe -d Ubuntu -u makoto --exec /usr/bin/sleep infinity
```

Replace `Ubuntu` and `makoto` with the actual distribution and WSL user. The Windows-side process prevents WSL from exiting after its last Ubuntu window closes; an in-guest `sleep infinity` process is not a replacement for it.

After closing the terminal, verify from Windows:

```powershell
curl.exe http://localhost:8650/health
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'wsl.exe' -and $_.CommandLine -match '/usr/bin/sleep infinity'
} | Select-Object Name, ProcessId, CommandLine
```

The health endpoint must return `{"status":"ok","service":"hermes-studio-account-gateway"}`. Do not run `wsl --shutdown` or end the `wsl.exe ... sleep infinity` process; either action stops the Studio services.

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
