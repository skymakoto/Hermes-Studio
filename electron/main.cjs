const { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage } = require('electron');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');

const { pathToFileURL } = require('node:url');

const { toWslPath: wslProjectPath } = require('./path-bridge.cjs');

const runProcess = promisify(execFile);
const IMAGE_EXTENSIONS = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);
const MAX_PREVIEW_BYTES = 12 * 1024 * 1024;
const WSL_IMAGE_ROOTS = (process.env.HERMES_STUDIO_WSL_IMAGE_ROOTS || '/home')
  .split(',')
  .map((root) => path.posix.normalize(root.trim()))
  .filter((root) => root.startsWith('/'));

function isAllowedWslImagePath(filePath) {
  const normalized = path.posix.normalize(String(filePath || '').trim());
  return normalized.startsWith('/') && WSL_IMAGE_ROOTS.some((root) => normalized === root || normalized.startsWith(`${root}/`));
}

async function loadImagePreview(filePath) {
  const normalizedPath = path.posix.normalize(String(filePath || '').trim());
  const extension = path.posix.extname(normalizedPath).toLowerCase();
  const mimeType = IMAGE_EXTENSIONS.get(extension);
  if (!mimeType || !isAllowedWslImagePath(normalizedPath)) return null;
  const quotedPath = `'${normalizedPath.replace(/'/g, "'\\\"'\\\"'")}'`;
  const roots = WSL_IMAGE_ROOTS.map((root) => `'${root}'`).join(' ');
  const script = `resolved=$(readlink -f -- ${quotedPath}) || exit 1; allowed=0; for root in ${roots}; do case "$resolved" in "$root"/*) allowed=1 ;; esac; done; test "$allowed" = 1 && test -f "$resolved" && test $(wc -c < "$resolved") -le ${MAX_PREVIEW_BYTES} && cat "$resolved"`;
  const { stdout } = await runProcess('wsl.exe', ['-d', 'Ubuntu', '--exec', '/bin/sh', '-c', script], { encoding: 'buffer', maxBuffer: MAX_PREVIEW_BYTES + 1024 });
  if (!Buffer.isBuffer(stdout) || !stdout.length || stdout.length > MAX_PREVIEW_BYTES) return null;
  return { path: normalizedPath, mimeType, dataUrl: `data:${mimeType};base64,${stdout.toString('base64')}` };
}


let mainWindow;
let activeRequest = null;
let activeRunId = null;
let sessionId = null;

function normalizeSessions(payload) {
  const sessions = Array.isArray(payload) ? payload : payload.data || payload.sessions;
  if (!Array.isArray(sessions)) return [];
  return sessions
    .filter((item) => item && typeof item.id === 'string')
    .map((item) => ({
      id: item.id,
      title: String(item.title || '未命名对话'),
      model: String(item.model || 'gpt-5.6-terra'),
      updatedAt: item.last_active || item.updated_at || item.updatedAt || item.started_at || item.created_at || item.createdAt || null,
    }));
}

function skinConfigPath() {
  const dataRoot = process.env.HERMES_STUDIO_DATA_DIR || app.getPath('userData');
  return path.join(dataRoot, 'skin.json');
}

function skinAssetDirectory() {
  return path.join(path.dirname(skinConfigPath()), 'skins');
}

function readSkinConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(skinConfigPath(), 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveSkinConfig(input) {
  const source = input && typeof input === 'object' ? input : {};
  const color = (value) => /^#[0-9a-f]{6}$/i.test(value || '') ? value : '';
  const percent = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback;
  const amount = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const imageFit = (value) => ['cover', 'contain', 'tile'].includes(value) ? value : 'cover';
  const skin = {
    name: String(source.name || '我的皮肤').slice(0, 48),
    backgroundImage: typeof source.backgroundImage === 'string' ? source.backgroundImage : '',
    fontFile: typeof source.fontFile === 'string' ? source.fontFile : '',
    textColor: color(source.textColor),
    textScale: amount(source.textScale, 80, 160, 100),
    accentColor: color(source.accentColor),
    backgroundOpacity: percent(source.backgroundOpacity, 72),
    backgroundPositionX: percent(source.backgroundPositionX, 50),
    backgroundPositionY: percent(source.backgroundPositionY, 50),
    backgroundFit: imageFit(source.backgroundFit),
    backgroundScale: amount(source.backgroundScale, 50, 200, 100),
    backgroundOverlayColor: color(source.backgroundOverlayColor),
    backgroundRadius: amount(source.backgroundRadius, 0, 32, 0),
    backgroundBorderColor: color(source.backgroundBorderColor),
    backgroundBorderOpacity: percent(source.backgroundBorderOpacity, 0),
    backgroundBlur: amount(source.backgroundBlur, 0, 28, 0),
    backgroundShadow: amount(source.backgroundShadow, 0, 50, 0),
    sidebarImage: typeof source.sidebarImage === 'string' ? source.sidebarImage : '',
    sidebarColor: color(source.sidebarColor),
    sidebarTextColor: color(source.sidebarTextColor),
    sidebarTextScale: amount(source.sidebarTextScale, 80, 160, 100),
    sidebarOpacity: percent(source.sidebarOpacity, 92),
    sidebarPositionX: percent(source.sidebarPositionX, 50),
    sidebarPositionY: percent(source.sidebarPositionY, 50),
    sidebarFit: imageFit(source.sidebarFit),
    sidebarOverlayColor: color(source.sidebarOverlayColor),
    sidebarRadius: amount(source.sidebarRadius, 0, 32, 0),
    sidebarBorderColor: color(source.sidebarBorderColor),
    sidebarBorderOpacity: percent(source.sidebarBorderOpacity, 0),
    sidebarBlur: amount(source.sidebarBlur, 0, 28, 10),
    sidebarShadow: amount(source.sidebarShadow, 0, 50, 0),
    composerImage: typeof source.composerImage === 'string' ? source.composerImage : '',
    composerColor: color(source.composerColor),
    composerTextColor: color(source.composerTextColor),
    composerTextScale: amount(source.composerTextScale, 80, 160, 100),
    composerOpacity: percent(source.composerOpacity, 90),
    composerPositionX: percent(source.composerPositionX, 50),
    composerPositionY: percent(source.composerPositionY, 50),
    composerFit: imageFit(source.composerFit),
    composerOverlayColor: color(source.composerOverlayColor),
    composerRadius: amount(source.composerRadius, 0, 32, 8),
    composerBorderColor: color(source.composerBorderColor),
    composerBorderOpacity: percent(source.composerBorderOpacity, 0),
    composerBlur: amount(source.composerBlur, 0, 28, 8),
    composerShadow: amount(source.composerShadow, 0, 50, 18),
  };
  fs.mkdirSync(path.dirname(skinConfigPath()), { recursive: true, mode: 0o700 });
  fs.writeFileSync(skinConfigPath(), JSON.stringify(skin, null, 2), { mode: 0o600 });
  return skin;
}

function importSkinAsset(filePath, kind) {
  const allowed = kind === 'font'
    ? new Set(['.ttf', '.otf', '.woff', '.woff2'])
    : new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
  const extension = path.extname(filePath).toLowerCase();
  if (!allowed.has(extension)) throw new Error(kind === 'font' ? '仅支持 TTF、OTF、WOFF 或 WOFF2 字体。' : '仅支持 PNG、JPG、WEBP 或 GIF 图片。');
  const info = fs.statSync(filePath);
  const maxSize = kind === 'font' ? 25 * 1024 * 1024 : 40 * 1024 * 1024;
  if (info.size > maxSize) throw new Error(kind === 'font' ? '字体文件不能超过 25MB。' : '背景图片不能超过 40MB。');
  fs.mkdirSync(skinAssetDirectory(), { recursive: true, mode: 0o700 });
  const safeName = `${kind}-${Date.now()}${extension}`;
  const destination = path.join(skinAssetDirectory(), safeName);
  fs.copyFileSync(filePath, destination);
  return { path: destination, name: path.basename(filePath), size: info.size };
}

function connectionPath() {
  const dataRoot = process.env.HERMES_STUDIO_DATA_DIR || app.getPath('userData');
  return path.join(dataRoot, 'connection.json');
}


function readConnection() {
  try {
    const parsed = JSON.parse(fs.readFileSync(connectionPath(), 'utf8'));
    const encryptedToken = Buffer.from(String(parsed.encryptedToken || ''), 'base64');
    return {
      accountBaseUrl: String(parsed.accountBaseUrl || 'http://localhost:8650').replace(/\/$/, ''),
      username: String(parsed.username || ''),
      token: encryptedToken.length && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(encryptedToken) : '',
    };
  } catch {
    return { accountBaseUrl: 'http://localhost:8650', username: '', token: '' };
  }
}

function saveAccount(input) {
  const accountBaseUrl = String(input?.accountBaseUrl || '').trim().replace(/\/$/, '');
  const username = String(input?.username || '').trim();
  const token = String(input?.token || '');
  if (!/^https?:\/\//.test(accountBaseUrl)) throw new Error('账户服务地址必须以 http:// 或 https:// 开头。');
  if (!username || !token) throw new Error('账号登录未完成。');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows 凭据加密不可用，无法安全保存登录令牌。');
  const encryptedToken = safeStorage.encryptString(token).toString('base64');
  fs.mkdirSync(path.dirname(connectionPath()), { recursive: true, mode: 0o700 });
  fs.writeFileSync(connectionPath(), JSON.stringify({ accountBaseUrl, username, encryptedToken }, null, 2), { mode: 0o600 });
  return { accountBaseUrl, username };
}

function clearAccount() {
  fs.rmSync(connectionPath(), { force: true });
  sessionId = null;
}

function accountHeaders(connection) {
  return {
    Authorization: `Bearer ${connection.token}`,
    'Content-Type': 'application/json',
  };
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function accountServiceError(error) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
    return new Error('连接 Hermes Studio 服务超时，请稍后重试。');
  }
  if (error instanceof TypeError && /fetch failed/i.test(error.message || '')) {
    return new Error('无法连接 Hermes Studio 服务。请确认 WSL 中的 Hermes Gateway 和账户服务正在运行。');
  }
  return error instanceof Error ? error : new Error('Hermes Studio 服务请求失败。');
}

async function accountFetch(connection, endpoint, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const attempts = method === 'GET' || method === 'HEAD' ? 2 : 1;
  let failure;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const timeout = AbortSignal.timeout(5000);
    try {
      const response = await fetch(`${connection.accountBaseUrl}${endpoint}`, {
        ...options,
        signal: options.signal || timeout,
        headers: { ...accountHeaders(connection), ...(options.headers || {}) },
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`账户服务 ${response.status}: ${detail || response.statusText}`);
      }
      return response;
    } catch (error) {
      failure = error;
      if (attempt + 1 < attempts && !options.signal?.aborted) await wait(300);
    }
  }
  throw accountServiceError(failure);
}

async function accountLogin(input) {
  const accountBaseUrl = String(input?.accountBaseUrl || '').trim().replace(/\/$/, '');
  const username = String(input?.username || '').trim();
  const password = String(input?.password || '');
  if (!/^https?:\/\//.test(accountBaseUrl)) throw new Error('账户服务地址必须以 http:// 或 https:// 开头。');
  if (!username || !password) throw new Error('请输入账号和密码。');
  let response;
  let failure;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(`${accountBaseUrl}/auth/login`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      break;
    } catch (error) {
      failure = error;
      if (attempt === 0) await wait(300);
    }
  }
  if (!response) throw accountServiceError(failure);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `登录失败 (${response.status})。`);
  return saveAccount({ accountBaseUrl, username: payload.username, token: payload.token });
}

async function accountRegister(input) {
  const accountBaseUrl = String(input?.accountBaseUrl || '').trim().replace(/\/$/, '');
  const username = String(input?.username || '').trim();
  const password = String(input?.password || '');
  const setupCode = String(input?.setupCode || '');
  if (!/^https?:\/\//.test(accountBaseUrl)) throw new Error('账户服务地址必须以 http:// 或 https:// 开头。');
  const response = await fetch(`${accountBaseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, setupCode }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `注册失败 (${response.status})。`);
  return accountLogin({ accountBaseUrl, username, password });
}

function sendTaskEvent(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('studio:task-event', payload);
}

function headers(connection) {
  return accountHeaders(connection);
}

async function apiFetch(connection, endpoint, options = {}) {
  return accountFetch(connection, `/hermes${endpoint}`, options);
}

async function createSession(connection, title, model = 'gpt-5.6-terra') {
  const response = await apiFetch(connection, '/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ title, model }),
  });
  const payload = await response.json();
  return payload.session.id;
}

function newSessionTitle() {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `新对话 · ${timestamp} ${suffix}`;
}

async function updateSessionTitle(connection, requestedSessionId, title) {
  if (typeof requestedSessionId !== 'string' || !requestedSessionId) return;
  const normalized = String(title || '').trim().slice(0, 72);
  try {
    await apiFetch(connection, `/api/sessions/${encodeURIComponent(requestedSessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: normalized }),
    });
  } catch (error) {
    if (!/already in use/i.test(error.message || '')) throw error;
    await apiFetch(connection, `/api/sessions/${encodeURIComponent(requestedSessionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: `${normalized} · ${requestedSessionId.slice(-6)}`.slice(0, 80) }),
    });
  }
}

function sessionTitleFromPrompt(prompt) {
  return String(prompt || '').replace(/\s+/g, ' ').trim().slice(0, 80) || '新对话';
}

async function listSessions(connection) {
  const response = await apiFetch(connection, '/api/sessions');
  return normalizeSessions(await response.json());
}

async function deleteSession(connection, requestedSessionId) {
  if (typeof requestedSessionId !== 'string' || !requestedSessionId) throw new Error('无效的对话标识。');
  await apiFetch(connection, `/api/sessions/${encodeURIComponent(requestedSessionId)}`, { method: 'DELETE' });
}

async function sessionConversationHistory(connection, currentSessionId) {
  if (!currentSessionId) return [];
  const response = await apiFetch(connection, `/api/sessions/${encodeURIComponent(currentSessionId)}/messages`);
  const payload = await response.json();
  const entries = Array.isArray(payload?.data) ? payload.data : [];
  return entries
    .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant'))
    .map((entry) => ({ role: entry.role, content: typeof entry.content === 'string' ? entry.content : typeof entry.text === 'string' ? entry.text : '' }))
    .filter((entry) => entry.content);
}

async function startRun(connection, input, instructions, currentSessionId, model, signal) {
  const history = await sessionConversationHistory(connection, currentSessionId);
  const provider = model.startsWith('deepseek-') ? 'deepseek' : 'nas-cdn';
  const modelIdentity = `Runtime identity: this conversation is running on provider ${provider} with model ${model}. If asked which model is running, state exactly this runtime identity and do not claim a different model.`;
  const response = await apiFetch(connection, '/v1/runs', {
    method: 'POST',
    body: JSON.stringify({ input, instructions: [modelIdentity, instructions].filter(Boolean).join('\n\n'), session_id: currentSessionId, conversation_history: history, model }),
    signal,
  });
  const payload = await response.json();
  if (!payload?.run_id) throw new Error('Hermes 没有返回运行标识。');
  return payload.run_id;
}

async function consumeRunEvents(connection, runId, signal) {
  const response = await apiFetch(connection, `/v1/runs/${encodeURIComponent(runId)}/events`, { signal });
  await consumeSse(response);
}

async function respondToApproval(connection, runId, choice) {
  const response = await apiFetch(connection, `/v1/runs/${encodeURIComponent(runId)}/approval`, {
    method: 'POST',
    body: JSON.stringify({ choice }),
  });
  return response.json();
}

async function consumeSse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';
  let dataLines = [];

  const dispatch = () => {
    if (!dataLines.length) return;
    const raw = dataLines.join('\n');
    dataLines = [];
    try {
      const payload = JSON.parse(raw);
      const effectiveEventName = typeof payload.event === 'string' ? payload.event : eventName;
      const eventMap = { 'message.delta': 'assistant.delta', 'run.failed': 'error', 'run.cancelled': 'run.stopped' };
      sendTaskEvent({ type: eventMap[effectiveEventName] || effectiveEventName, payload, at: Date.now() });
    } catch {
      sendTaskEvent({ type: 'error', text: `Invalid API event: ${raw}`, at: Date.now() });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line) {
        dispatch();
        eventName = 'message';
      } else if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (done) break;
  }
  dispatch();
}

function stopActiveTask() {
  if (!activeRequest) return false;
  activeRequest.abort();
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#111315',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => stopActiveTask());

ipcMain.handle('studio:status', async () => {
  const connection = readConnection();
  let connected = false;
  let error = '';
  if (connection.token) {
    try {
      const response = await accountFetch(connection, '/auth/me');
      connected = Boolean((await response.json()).username);
    } catch (failure) {
      error = failure.message;
    }
  }
  return { running: Boolean(activeRequest), connected, error, configured: Boolean(connection.token), accountBaseUrl: connection.accountBaseUrl, username: connection.username };
});

ipcMain.handle('studio:account', () => {
  const connection = readConnection();
  return { accountBaseUrl: connection.accountBaseUrl, username: connection.username, configured: Boolean(connection.token) };
});

ipcMain.handle('studio:login', async (_event, input) => {
  try {
    return { ok: true, account: await accountLogin(input) };
  } catch (error) {
    return { ok: false, error: accountServiceError(error).message };
  }
});
ipcMain.handle('studio:register', async (_event, input) => {
  try {
    return { ok: true, account: await accountRegister(input) };
  } catch (error) {
    return { ok: false, error: accountServiceError(error).message };
  }
});
ipcMain.handle('studio:logout', async () => {
  const connection = readConnection();
  if (connection.token) {
    try { await accountFetch(connection, '/auth/logout', { method: 'POST' }); } catch { /* Local token removal is still required. */ }
  }
  clearAccount();
  return { ok: true };
});

ipcMain.handle('studio:load-image-previews', async (_event, paths) => {
  if (!Array.isArray(paths)) return [];
  const uniquePaths = [...new Set(paths.filter((item) => typeof item === 'string' && item.length <= 4096))].slice(0, 6);
  const previews = await Promise.all(uniquePaths.map(async (filePath) => {
    try { return await loadImagePreview(filePath); } catch { return null; }
  }));
  return previews.filter(Boolean);
});

ipcMain.handle('studio:choose-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入文件',
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return [];
  return result.filePaths.map((filePath) => {
    const info = fs.statSync(filePath);
    return { path: filePath, wslPath: wslProjectPath(filePath), name: path.basename(filePath), size: info.size };
  });
});

ipcMain.handle('studio:get-skin', () => readSkinConfig());
ipcMain.handle('studio:save-skin', (_event, input) => saveSkinConfig(input));
ipcMain.handle('studio:reset-skin', () => saveSkinConfig({}));
ipcMain.handle('studio:export-skin', async (_event, input) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出皮肤方案',
    defaultPath: `${String(input?.name || 'hermes-studio-skin').replace(/[^a-z0-9_-]/gi, '-')}.json`,
    filters: [{ name: 'Hermes Studio 皮肤', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify(saveSkinConfig(input), null, 2), { mode: 0o600 });
  return { canceled: false, path: result.filePath };
});
ipcMain.handle('studio:import-skin', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '导入皮肤方案',
    properties: ['openFile'],
    filters: [{ name: 'Hermes Studio 皮肤', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const info = fs.statSync(result.filePaths[0]);
  if (info.size > 512 * 1024) throw new Error('皮肤配置不能超过 512KB。');
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8')); } catch { throw new Error('这不是有效的皮肤配置文件。'); }
  return saveSkinConfig(parsed);
});
ipcMain.handle('studio:choose-skin-asset', async (_event, kind) => {
  const isFont = kind === 'font';
  const result = await dialog.showOpenDialog(mainWindow, {
    title: isFont ? '选择皮肤字体' : '选择皮肤背景图',
    properties: ['openFile'],
    filters: isFont
      ? [{ name: '字体文件', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
      : [{ name: '背景图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return importSkinAsset(result.filePaths[0], isFont ? 'font' : 'background');
});

ipcMain.handle('studio:list-sessions', async () => {
  const connection = readConnection();
  if (!connection.token) return { sessions: [], activeSessionId: null };
  return { sessions: await listSessions(connection), activeSessionId: sessionId };
});

ipcMain.handle('studio:get-session-messages', async (_event, requestedSessionId) => {
  const connection = readConnection();
  if (!connection.token) return { ok: false, error: '请先连接 Hermes Studio 账号。' };
  if (typeof requestedSessionId !== 'string' || !requestedSessionId) return { ok: false, error: '无效的对话标识。' };
  try {
    const response = await apiFetch(connection, `/api/sessions/${encodeURIComponent(requestedSessionId)}/messages`);
    return { ok: true, payload: await response.json() };
  } catch (error) {
    return { ok: false, error: accountServiceError(error).message };
  }
});

ipcMain.handle('studio:delete-session', async (_event, requestedSessionId) => {
  if (activeRequest) return { ok: false, error: '任务运行中，不能删除对话。' };
  const connection = readConnection();
  if (!connection.token) throw new Error('请先连接 Hermes Studio 账号。');
  await deleteSession(connection, requestedSessionId);
  if (sessionId === requestedSessionId) sessionId = null;
  return { ok: true };
});

ipcMain.handle('studio:new-session', async (_event, input) => {
  if (activeRequest) return { ok: false, error: '任务运行中，不能切换对话。' };
  const model = String(input?.model || 'gpt-5.6-terra').trim();
  const allowedModels = new Set(['gpt-5.4', 'gpt-5.5', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna', 'deepseek-v4-pro', 'deepseek-v4-flash']);
  if (!allowedModels.has(model)) return { ok: false, error: '不支持的模型。' };
  const connection = readConnection();
  if (!connection.token) return { ok: false, error: '请先连接 Hermes Studio 账号。' };
  sessionId = await createSession(connection, newSessionTitle(), model);
  return { ok: true, sessionId, model };
});

ipcMain.handle('studio:select-session', (_event, requestedSessionId) => {
  if (activeRequest) return { ok: false, error: '任务运行中，不能切换对话。' };
  sessionId = typeof requestedSessionId === 'string' && requestedSessionId ? requestedSessionId : null;
  return { ok: Boolean(sessionId), sessionId };
});

ipcMain.handle('studio:run-task', async (_event, input) => {
  if (activeRequest) return { ok: false, error: 'A Hermes task is already running.' };
  const prompt = String(input?.prompt || '').trim();
  const model = String(input?.model || 'gpt-5.6-terra').trim();
  const allowedModels = new Set(['gpt-5.4', 'gpt-5.5', 'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna', 'deepseek-v4-pro', 'deepseek-v4-flash']);
  if (!prompt) return { ok: false, error: 'Task prompt cannot be empty.' };
  if (!allowedModels.has(model)) return { ok: false, error: '不支持的模型。' };
  const connection = readConnection();
  if (!connection.token) return { ok: false, error: '请先连接 Hermes Studio 账号。' };

  const attachments = Array.isArray(input?.attachments) ? input.attachments : [];
  const safeAttachments = attachments
    .filter((file) => typeof file?.wslPath === 'string' && typeof file?.name === 'string')
    .slice(0, 20)
    .map((file) => ({ name: path.basename(file.name), wslPath: file.wslPath }));
  const controller = new AbortController();
  activeRequest = controller;
  try {
    if (!sessionId) sessionId = await createSession(connection, newSessionTitle(), model);
    await updateSessionTitle(connection, sessionId, sessionTitleFromPrompt(prompt));
    const attachmentInstruction = safeAttachments.length
      ? `The user imported these files from Windows. Read them from WSL paths as needed:\n${safeAttachments.map((file) => `- ${file.name}: ${file.wslPath}`).join('\n')}`
      : '';
    activeRunId = await startRun(connection, prompt, attachmentInstruction, sessionId, model, controller.signal);
    sendTaskEvent({ type: 'run.started', payload: { session_id: sessionId, run_id: activeRunId, model }, at: Date.now() });
    await consumeRunEvents(connection, activeRunId, controller.signal);
    return { ok: true, sessionId };
  } catch (error) {
    const interrupted = error.name === 'AbortError';
    sendTaskEvent({ type: interrupted ? 'run.stopped' : 'error', text: interrupted ? 'Task stopped.' : error.message, at: Date.now() });
    return { ok: false, error: interrupted ? 'Task stopped.' : error.message };
  } finally {
    activeRequest = null;
    activeRunId = null;
  }
});

ipcMain.handle('studio:respond-approval', async (_event, choice) => {
  const allowed = new Set(['once', 'session', 'always', 'deny']);
  if (!activeRunId) return { ok: false, error: '当前没有等待确认的任务。' };
  if (!allowed.has(choice)) return { ok: false, error: '无效的确认选项。' };
  const connection = readConnection();
  if (!connection.token) return { ok: false, error: '请先连接 Hermes Studio 账号。' };
  const result = await respondToApproval(connection, activeRunId, choice);
  return { ok: true, choice: result.choice || choice, resolved: result.resolved || 0 };
});

ipcMain.handle('studio:stop-task', async () => {
  if (!activeRequest) return { ok: false, error: 'No active Hermes task.' };
  const runId = activeRunId;
  if (runId) {
    try {
      const connection = readConnection();
      if (connection.token) await apiFetch(connection, `/v1/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST' });
    } catch {
      // Abort below still stops this Studio stream if the API run already ended.
    }
  }
  return { ok: stopActiveTask() };
});
