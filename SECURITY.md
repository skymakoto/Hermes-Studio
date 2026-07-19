# Security Policy

## Supported deployment model

Hermes Studio is intended for trusted users on the same localhost or Tailscale network. The account gateway rejects public Internet addresses and only accepts localhost plus the Tailscale CGNAT range (`100.64.0.0/10`). Do not add a public reverse proxy, port forwarding, or public DNS endpoint in front of port `8650`.

## Trust boundary

Studio accounts isolate login tokens, session identity, and the `X-Hermes-Session-Key` namespace. They do not sandbox Hermes tools. A user with access to a Studio account may cause the shared Hermes runtime to use its enabled terminal, file, and network tools.

Only give pairing codes and accounts to people you trust with the server host's available Hermes capabilities.

## Secrets and private files

Never commit, publish, or send these files:

- `account-gateway.env`
- `connection.json`
- `users.json` and `sessions.json`
- `~/.hermes/`, including `.env`, `auth.json`, `config.yaml`, session data, and logs
- API keys, provider credentials, Tailscale auth keys, pairing codes, or password exports

Use the repository templates as starting points, create real files outside the repository, and restrict them to the owning user (`chmod 600`).

## Reporting a vulnerability

Do not open a public issue for a suspected credential leak, authentication bypass, or network exposure. Contact the repository maintainer privately with reproduction steps and avoid including real secrets in the report.