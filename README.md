# Hermes Studio

[English README](README.en.md)

Hermes Studio 是一个面向可信私有网络的 Windows 桌面客户端，连接到你自己运行在 WSL/Linux 上的 Hermes Agent。客户端不保存 Hermes API Key、模型 Provider 凭据、技能、记忆或会话数据库；这些数据保留在服务端主机。

> 当前版本适合个人、小团队或同一 Tailscale 网络内的可信用户。它不是多租户沙箱，也不应暴露到公网。

## 功能

- Windows 原生 Electron 客户端，支持流式回复和工具活动。
- WSL/Linux 账户网关：用户使用账号和密码登录，客户端只保存 Windows DPAPI 保护的令牌。
- Hermes API Key 只保留在服务端；网关向 Hermes API 转发已认证请求。
- 会话列表、新建/切换/删除会话、模型选择、文件选择和皮肤设置。
- 通过 `X-Hermes-Session-Key` 让不同 Studio 账号使用独立的 Hermes 会话命名空间。

## 架构

```text
Windows Hermes Studio
        |
        | HTTPS/HTTP over localhost or Tailscale
        v
WSL/Linux Account Gateway :8650
        |
        | private Hermes API key
        v
Hermes API Server :8642
```

## 快速使用：Windows 客户端

1. 从 GitHub Releases 下载 Windows x64 portable `.exe`。
2. 加入管理员主机所在的 Tailscale 网络。
3. 启动 Studio，在连接界面填写：
   - 本机服务：`http://localhost:8650`
   - 远程服务：`http://<TAILSCALE_HOST_IP>:8650`
4. 使用管理员提供的配对码注册账号，或登录已有账号。

普通客户端不需要安装 Hermes CLI、Python、Node.js 或配置任何 API Key。

## 自托管服务端

### 前提

- Linux 或 WSL2，建议使用 systemd user service。
- 已安装并能运行 [Hermes Agent](https://hermes-agent.nousresearch.com/docs)。
- Hermes API Server 已在本机监听，例如 `http://127.0.0.1:8642`。
- Python 3.11+。
- Tailscale，若需要让其他设备访问。

### 安装

```bash
git clone https://github.com/<YOUR_GITHUB_USER>/hermes-studio.git
cd hermes-studio
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

复制并填写私有配置。不要提交生成后的真实文件：

```bash
mkdir -p ~/.config/hermes-studio ~/.local/share/hermes-studio
cp wsl/account-gateway.env.example ~/.config/hermes-studio/account-gateway.env
cp wsl/connection.json.example ~/.local/share/hermes-studio/connection.json
chmod 600 ~/.config/hermes-studio/account-gateway.env ~/.local/share/hermes-studio/connection.json
```

编辑 `~/.config/hermes-studio/account-gateway.env`：

- 使用足够长且随机的 `HERMES_STUDIO_SETUP_CODE`。
- 远程 Tailscale 用户需要访问时使用 `HERMES_STUDIO_ACCOUNT_HOST=0.0.0.0`。
- 仅供本机使用时改为 `127.0.0.1`。

编辑 `~/.local/share/hermes-studio/connection.json`：

- `apiBaseUrl`：本机 Hermes API 地址。
- `apiKey`：本机 Hermes API Key。

启用 systemd 用户服务：

```bash
mkdir -p ~/.config/systemd/user
sed "s|%h/hermes-studio|$HOME/hermes-studio|g" \
  wsl/hermes-studio-account.service.example \
  > ~/.config/systemd/user/hermes-studio-account.service
systemctl --user daemon-reload
systemctl --user enable --now hermes-studio-account.service
systemctl --user status hermes-studio-account.service
```

确认网关状态：

```bash
curl http://127.0.0.1:8650/health
```

## 本地开发

```bash
npm ci
npm test
npm start
```

Windows 构建：

```powershell
npm ci
npm run dist:win:portable
```

构建产物在 `release/`。正式版本应通过 GitHub Releases 发布，不要提交 `release/` 到 Git。

## 安全边界

- 网关仅允许 localhost 和 Tailscale CGNAT 网段 `100.64.0.0/10` 的客户端访问。
- 账号隔离登录令牌、Studio 会话身份和 scoped memory；**不隔离** Hermes 的终端或文件系统工具权限。
- 不要把端口 8650 暴露到公网，也不要向不可信用户发放配对码。
- 不要提交 `connection.json`、`account-gateway.env`、`users.json`、`sessions.json`、`~/.hermes/` 或任何 API Key。
- 完整风险说明请见 [SECURITY.md](SECURITY.md)。

## 发布维护者指南

提交前运行：

```bash
npm test
python3 -m py_compile wsl/account_gateway.py
```

建议使用 GitHub Actions 在 Windows runner 上构建 portable 包，再由 tag 创建 GitHub Release。仓库只保存源码、示例配置和文档；二进制文件作为 Release 附件上传。

## 许可证

本项目采用 [MIT License](LICENSE)。
