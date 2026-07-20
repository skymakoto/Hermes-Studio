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

### WSL 常驻运行（关闭 Ubuntu 终端后仍可用）

`systemd --user` 的 `linger` 只能使用户服务在 WSL 仍运行时脱离终端存活；它不会阻止 Windows 在最后一个 WSL 客户端退出后回收整个 WSL 虚拟机。若 Studio 在关闭 Ubuntu 窗口后无法连接，必须同时保活 Windows 侧的 Ubuntu 实例。

#### 已确认的问题复盘

曾出现的现象是：关闭最后一个 Ubuntu/CLI 窗口后，Studio 登录报 `TypeError: fetch failed` 或提示无法连接 Studio 服务；重新唤醒 WSL 后恢复。排查时，`hermes-gateway.service`、`hermes-studio-account.service`、端口 `8642`/`8650`、账户网关到 Hermes API 的认证健康请求，以及 Windows 对 `localhost:8650` 的访问均正常。因此根因不是 Studio 网关地址、账户服务或 Hermes Gateway 配置，而是最后一个 WSL 客户端退出后 Windows 回收了 WSL 实例，使本地服务不再运行。

不要把关闭一个额外启动的 WSL 子进程当作有效验证：只要原 Ubuntu/CLI 窗口仍开着，WSL 实例并未进入真实的“最后一个客户端退出”状态。有效验收是关闭最后一个 Ubuntu 窗口后，从 Windows 检查健康接口仍可访问，并确认 Windows 侧保活 `wsl.exe` 进程仍存在。

1. 确认 `/etc/wsl.conf` 包含：

```ini
[boot]
systemd=true
```

2. 在 WSL 中启用服务与用户 linger：

```bash
loginctl enable-linger "$USER"
systemctl --user enable --now hermes-gateway.service hermes-studio-account.service
```

若已自行创建 guest 保活单元，也可以启用它；但它不能替代下一步的 Windows 侧保活进程。

3. 在 Windows 登录启动项或计划任务中启动一个隐藏的宿主保活进程。命令必须持续运行，不能只执行一次 `systemctl start`：

```powershell
wsl.exe -d Ubuntu -u makoto --exec /usr/bin/sleep infinity
```

将 `Ubuntu` 和 `makoto` 替换为实际发行版和 WSL 用户。Windows 侧进程才是防止 WSL 因关闭最后一个 Ubuntu 窗口而退出的关键；WSL 内的 `sleep infinity` 不能单独替代它。

关闭终端后从 Windows 验证：

```powershell
curl.exe http://localhost:8650/health
Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'wsl.exe' -and $_.CommandLine -match '/usr/bin/sleep infinity'
} | Select-Object Name, ProcessId, CommandLine
```

预期健康检查返回 `{"status":"ok","service":"hermes-studio-account-gateway"}`。不要执行 `wsl --shutdown`，也不要结束上述 `wsl.exe ... sleep infinity` 进程；两者都会停止 Studio 服务。

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
