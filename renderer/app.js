const state = {
  running: false,
  output: '',
  taskStartedAt: null,
  assistant: null,
  attachments: [],
  registerMode: false,
  sessions: [],
  activeSessionId: null,
  loadingSession: false,
  contextSessionId: null,
  pendingApproval: null,
  customSkin: {},
  savedCustomSkin: {},
};

const $ = (selector) => document.querySelector(selector);
const prompt = $('#prompt');
const messages = $('#messages');
const welcome = $('#welcome');
const log = $('#activity-log');
const sendButton = $('#send-task');
const stopButton = $('#stop-task');
const runState = $('#run-state');
const connectionDialog = $('#connection-dialog');
const attachmentList = $('#attachment-list');
const modelSelect = $('#model-select');

const skins = [
  { id: 'warm-paper', name: '暖纸' },
  { id: 'midnight-garden', name: '夜园' },
  { id: 'rose-dawn', name: '蔷薇晨光' },
];

function applySkin(skinId) {
  const skin = skins.find((item) => item.id === skinId) || skins[0];
  document.body.dataset.skin = skin.id === 'warm-paper' ? '' : skin.id;
  $('#skin-name').textContent = skin.name;
  localStorage.setItem('hermes-studio-skin', skin.id);
}

function cycleSkin() {
  const current = document.body.dataset.skin || 'warm-paper';
  const index = skins.findIndex((item) => item.id === current);
  applySkin(skins[(index + 1) % skins.length].id);
}

function fileUrl(filePath) {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  return `file:///${encodeURI(normalized)}`;
}

function assetName(filePath, fallback) {
  const pieces = String(filePath || '').split(/[\\/]/);
  return pieces[pieces.length - 1] || fallback;
}

function normalizeCustomSkin(input = {}) {
  return {
    backgroundImage: typeof input.backgroundImage === 'string' ? input.backgroundImage : '',
    fontFile: typeof input.fontFile === 'string' ? input.fontFile : '',
    textColor: /^#[0-9a-f]{6}$/i.test(input.textColor || '') ? input.textColor : '',
    textScale: Number.isFinite(Number(input.textScale)) ? Math.max(80, Math.min(160, Number(input.textScale))) : 100,
    accentColor: /^#[0-9a-f]{6}$/i.test(input.accentColor || '') ? input.accentColor : '',
    backgroundOpacity: Number.isFinite(Number(input.backgroundOpacity)) ? Math.max(0, Math.min(100, Number(input.backgroundOpacity))) : 72,
    backgroundPositionX: Number.isFinite(Number(input.backgroundPositionX)) ? Math.max(0, Math.min(100, Number(input.backgroundPositionX))) : 50,
    backgroundPositionY: Number.isFinite(Number(input.backgroundPositionY)) ? Math.max(0, Math.min(100, Number(input.backgroundPositionY))) : 50,
    sidebarImage: typeof input.sidebarImage === 'string' ? input.sidebarImage : '',
    sidebarColor: /^#[0-9a-f]{6}$/i.test(input.sidebarColor || '') ? input.sidebarColor : '',
    sidebarTextColor: /^#[0-9a-f]{6}$/i.test(input.sidebarTextColor || '') ? input.sidebarTextColor : '',
    sidebarTextScale: Number.isFinite(Number(input.sidebarTextScale)) ? Math.max(80, Math.min(160, Number(input.sidebarTextScale))) : 100,
    sidebarOpacity: Number.isFinite(Number(input.sidebarOpacity)) ? Math.max(0, Math.min(100, Number(input.sidebarOpacity))) : 92,
    composerImage: typeof input.composerImage === 'string' ? input.composerImage : '',
    composerColor: /^#[0-9a-f]{6}$/i.test(input.composerColor || '') ? input.composerColor : '',
    composerTextColor: /^#[0-9a-f]{6}$/i.test(input.composerTextColor || '') ? input.composerTextColor : '',
    composerTextScale: Number.isFinite(Number(input.composerTextScale)) ? Math.max(80, Math.min(160, Number(input.composerTextScale))) : 100,
    composerOpacity: Number.isFinite(Number(input.composerOpacity)) ? Math.max(0, Math.min(100, Number(input.composerOpacity))) : 90,
    backgroundFit: ['cover', 'contain', 'tile'].includes(input.backgroundFit) ? input.backgroundFit : 'cover',
    backgroundScale: Number.isFinite(Number(input.backgroundScale)) ? Math.max(50, Math.min(200, Number(input.backgroundScale))) : 100,
    backgroundOverlayColor: /^#[0-9a-f]{6}$/i.test(input.backgroundOverlayColor || '') ? input.backgroundOverlayColor : '',
    backgroundRadius: Number.isFinite(Number(input.backgroundRadius)) ? Math.max(0, Math.min(32, Number(input.backgroundRadius))) : 0,
    backgroundBorderColor: /^#[0-9a-f]{6}$/i.test(input.backgroundBorderColor || '') ? input.backgroundBorderColor : '',
    backgroundBorderOpacity: Number.isFinite(Number(input.backgroundBorderOpacity)) ? Math.max(0, Math.min(100, Number(input.backgroundBorderOpacity))) : 0,
    backgroundBlur: Number.isFinite(Number(input.backgroundBlur)) ? Math.max(0, Math.min(28, Number(input.backgroundBlur))) : 0,
    backgroundShadow: Number.isFinite(Number(input.backgroundShadow)) ? Math.max(0, Math.min(50, Number(input.backgroundShadow))) : 0,
    sidebarPositionX: Number.isFinite(Number(input.sidebarPositionX)) ? Math.max(0, Math.min(100, Number(input.sidebarPositionX))) : 50,
    sidebarPositionY: Number.isFinite(Number(input.sidebarPositionY)) ? Math.max(0, Math.min(100, Number(input.sidebarPositionY))) : 50,
    sidebarFit: ['cover', 'contain', 'tile'].includes(input.sidebarFit) ? input.sidebarFit : 'cover',
    sidebarOverlayColor: /^#[0-9a-f]{6}$/i.test(input.sidebarOverlayColor || '') ? input.sidebarOverlayColor : '',
    sidebarRadius: Number.isFinite(Number(input.sidebarRadius)) ? Math.max(0, Math.min(32, Number(input.sidebarRadius))) : 0,
    sidebarBorderColor: /^#[0-9a-f]{6}$/i.test(input.sidebarBorderColor || '') ? input.sidebarBorderColor : '',
    sidebarBorderOpacity: Number.isFinite(Number(input.sidebarBorderOpacity)) ? Math.max(0, Math.min(100, Number(input.sidebarBorderOpacity))) : 0,
    sidebarBlur: Number.isFinite(Number(input.sidebarBlur)) ? Math.max(0, Math.min(28, Number(input.sidebarBlur))) : 10,
    sidebarShadow: Number.isFinite(Number(input.sidebarShadow)) ? Math.max(0, Math.min(50, Number(input.sidebarShadow))) : 0,
    composerPositionX: Number.isFinite(Number(input.composerPositionX)) ? Math.max(0, Math.min(100, Number(input.composerPositionX))) : 50,
    composerPositionY: Number.isFinite(Number(input.composerPositionY)) ? Math.max(0, Math.min(100, Number(input.composerPositionY))) : 50,
    composerFit: ['cover', 'contain', 'tile'].includes(input.composerFit) ? input.composerFit : 'cover',
    composerOverlayColor: /^#[0-9a-f]{6}$/i.test(input.composerOverlayColor || '') ? input.composerOverlayColor : '',
    composerRadius: Number.isFinite(Number(input.composerRadius)) ? Math.max(0, Math.min(32, Number(input.composerRadius))) : 8,
    composerBorderColor: /^#[0-9a-f]{6}$/i.test(input.composerBorderColor || '') ? input.composerBorderColor : '',
    composerBorderOpacity: Number.isFinite(Number(input.composerBorderOpacity)) ? Math.max(0, Math.min(100, Number(input.composerBorderOpacity))) : 0,
    composerBlur: Number.isFinite(Number(input.composerBlur)) ? Math.max(0, Math.min(28, Number(input.composerBlur))) : 8,
    composerShadow: Number.isFinite(Number(input.composerShadow)) ? Math.max(0, Math.min(50, Number(input.composerShadow))) : 18,
    name: String(input.name || '我的皮肤').slice(0, 48),
  };
}

function hexOverlay(color, opacity) {
  const value = /^#[0-9a-f]{6}$/i.test(color || '') ? color.slice(1) : 'ffffff';
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgb(${red} ${green} ${blue} / ${Math.max(0, Math.min(100, opacity)) / 100})`;
}

function applyCustomSkin(input = {}) {
  const custom = normalizeCustomSkin(input);
  state.customSkin = custom;
  const root = document.documentElement;
  const setCustomProperty = (name, value) => {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  };
  setCustomProperty('--custom-background-image', custom.backgroundImage ? `url("${fileUrl(custom.backgroundImage)}")` : '');
  root.style.setProperty('--custom-background-opacity', String(custom.backgroundImage ? custom.backgroundOpacity / 100 : 0));
  root.style.setProperty('--custom-background-overlay-layer', hexOverlay(custom.backgroundOverlayColor, custom.backgroundImage ? custom.backgroundOpacity : 0));
  root.style.setProperty('--custom-background-position', `${custom.backgroundPositionX}% ${custom.backgroundPositionY}%`);
  root.style.setProperty('--custom-background-fit', custom.backgroundFit === 'tile' ? 'auto' : `${custom.backgroundScale}%`);
  root.style.setProperty('--custom-background-repeat', custom.backgroundFit === 'tile' ? 'repeat' : 'no-repeat');
  setCustomProperty('--custom-background-overlay', custom.backgroundOverlayColor);
  root.style.setProperty('--custom-background-radius', `${custom.backgroundRadius}px`);
  setCustomProperty('--custom-background-border', custom.backgroundBorderColor);
  root.style.setProperty('--custom-background-border-opacity', String(custom.backgroundBorderOpacity / 100));
  root.style.setProperty('--custom-background-blur', `${custom.backgroundBlur}px`);
  root.style.setProperty('--custom-background-shadow', `${custom.backgroundShadow}px`);
  setCustomProperty('--custom-sidebar-image', custom.sidebarImage ? `url("${fileUrl(custom.sidebarImage)}")` : '');
  setCustomProperty('--custom-sidebar-color', custom.sidebarColor);
  setCustomProperty('--custom-sidebar-text-color', custom.sidebarTextColor);
  root.style.setProperty('--custom-sidebar-opacity', String(custom.sidebarImage ? custom.sidebarOpacity / 100 : 0));
  root.style.setProperty('--custom-sidebar-overlay-layer', hexOverlay(custom.sidebarOverlayColor, custom.sidebarImage ? custom.sidebarOpacity : 0));
  root.style.setProperty('--custom-sidebar-position', `${custom.sidebarPositionX}% ${custom.sidebarPositionY}%`);
  root.style.setProperty('--custom-sidebar-fit', custom.sidebarFit === 'tile' ? 'auto' : custom.sidebarFit);
  root.style.setProperty('--custom-sidebar-repeat', custom.sidebarFit === 'tile' ? 'repeat' : 'no-repeat');
  setCustomProperty('--custom-sidebar-overlay', custom.sidebarOverlayColor);
  root.style.setProperty('--custom-sidebar-radius', `${custom.sidebarRadius}px`);
  setCustomProperty('--custom-sidebar-border', custom.sidebarBorderColor);
  root.style.setProperty('--custom-sidebar-border-opacity', String(custom.sidebarBorderOpacity / 100));
  root.style.setProperty('--custom-sidebar-blur', `${custom.sidebarBlur}px`);
  root.style.setProperty('--custom-sidebar-shadow', `${custom.sidebarShadow}px`);
  setCustomProperty('--custom-composer-image', custom.composerImage ? `url("${fileUrl(custom.composerImage)}")` : '');
  setCustomProperty('--custom-composer-color', custom.composerColor);
  setCustomProperty('--custom-composer-text-color', custom.composerTextColor);
  root.style.setProperty('--custom-composer-opacity', String(custom.composerImage ? custom.composerOpacity / 100 : 0));
  root.style.setProperty('--custom-composer-overlay-layer', hexOverlay(custom.composerOverlayColor, custom.composerImage ? custom.composerOpacity : 0));
  root.style.setProperty('--custom-composer-position', `${custom.composerPositionX}% ${custom.composerPositionY}%`);
  root.style.setProperty('--custom-composer-fit', custom.composerFit === 'tile' ? 'auto' : custom.composerFit);
  root.style.setProperty('--custom-composer-repeat', custom.composerFit === 'tile' ? 'repeat' : 'no-repeat');
  setCustomProperty('--custom-composer-overlay', custom.composerOverlayColor);
  root.style.setProperty('--custom-composer-radius', `${custom.composerRadius}px`);
  setCustomProperty('--custom-composer-border', custom.composerBorderColor);
  root.style.setProperty('--custom-composer-border-opacity', String(custom.composerBorderOpacity / 100));
  root.style.setProperty('--custom-composer-blur', `${custom.composerBlur}px`);
  root.style.setProperty('--custom-composer-shadow', `${custom.composerShadow}px`);
  setCustomProperty('--custom-text-color', custom.textColor);
  root.style.setProperty('--custom-text-scale', String(custom.textScale / 100));
  root.style.setProperty('--custom-sidebar-text-scale', String(custom.sidebarTextScale / 100));
  root.style.setProperty('--custom-composer-text-scale', String(custom.composerTextScale / 100));
  setCustomProperty('--custom-accent-color', custom.accentColor);
  setCustomProperty('--custom-font-family', custom.fontFile ? 'HermesCustomSkin, "Segoe UI Variable", "Microsoft YaHei UI", sans-serif' : '');
  let fontStyle = document.getElementById('custom-skin-font');
  if (fontStyle) fontStyle.remove();
  if (custom.fontFile) {
    fontStyle = document.createElement('style');
    fontStyle.id = 'custom-skin-font';
    fontStyle.textContent = `@font-face { font-family: HermesCustomSkin; src: url("${fileUrl(custom.fontFile)}"); font-display: swap; }`;
    document.head.append(fontStyle);
  }
  updateSkinDialog();
}

function updateSkinDialog() {
  const custom = state.customSkin;
  if (!$('#skin-dialog')) return;
  $('#skin-background-name').textContent = assetName(custom.backgroundImage, '未选择');
  $('#skin-font-name').textContent = assetName(custom.fontFile, '系统默认字体');
  $('#skin-text-color').value = custom.textColor || '#302d2a';
  $('#skin-text-scale').value = String(custom.textScale);
  $('#skin-text-scale-value').textContent = `${custom.textScale}%`;
  $('#skin-sidebar-text-scale').value = String(custom.sidebarTextScale);
  $('#skin-sidebar-text-scale-value').textContent = `${custom.sidebarTextScale}%`;
  $('#skin-composer-text-scale').value = String(custom.composerTextScale);
  $('#skin-composer-text-scale-value').textContent = `${custom.composerTextScale}%`;
  $('#skin-accent-color').value = custom.accentColor || '#d66b52';
  $('#skin-opacity').value = String(custom.backgroundOpacity);
  $('#skin-name-input').value = custom.name;
  $('#skin-background-fit').value = custom.backgroundFit;
  $('#skin-background-scale').value = custom.backgroundScale;
  $('#skin-background-scale-value').textContent = `${custom.backgroundScale}%`;
  ['backgroundRadius', 'backgroundBorderOpacity', 'backgroundBlur', 'backgroundShadow', 'sidebarPositionX', 'sidebarPositionY', 'sidebarRadius', 'sidebarBorderOpacity', 'sidebarBlur', 'sidebarShadow', 'composerPositionX', 'composerPositionY', 'composerRadius', 'composerBorderOpacity', 'composerBlur', 'composerShadow'].forEach((key) => { const id = `skin-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`; const field = $(id); const output = $(`${id}-value`); if (field) field.value = custom[key]; if (output) output.textContent = `${custom[key]}${key.includes('Position') || key.includes('Opacity') ? '%' : 'px'}`; });
  ['backgroundOverlayColor','backgroundBorderColor','sidebarOverlayColor','sidebarBorderColor','composerOverlayColor','composerBorderColor'].forEach((key) => { const field = $(`#skin-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`); if (field) field.value = custom[key] || '#ffffff'; });
  $('#skin-sidebar-fit').value = custom.sidebarFit;
  $('#skin-composer-fit').value = custom.composerFit;
  $('#skin-position-x').value = String(custom.backgroundPositionX);
  $('#skin-position-y').value = String(custom.backgroundPositionY);
  $('#skin-position-x-value').textContent = `${custom.backgroundPositionX}%`;
  $('#skin-position-y-value').textContent = `${custom.backgroundPositionY}%`;
  $('#skin-sidebar-name').textContent = assetName(custom.sidebarImage, '使用默认表面');
  $('#skin-sidebar-color').value = custom.sidebarColor || '#f8f3eb';
  $('#skin-sidebar-text-color').value = custom.sidebarTextColor || '#302d2a';
  $('#skin-sidebar-opacity').value = String(custom.sidebarOpacity);
  $('#skin-sidebar-opacity-value').textContent = `${custom.sidebarOpacity}%`;
  $('#skin-composer-name').textContent = assetName(custom.composerImage, '使用默认表面');
  $('#skin-composer-color').value = custom.composerColor || '#fffaf2';
  $('#skin-composer-text-color').value = custom.composerTextColor || '#302d2a';
  $('#skin-composer-opacity').value = String(custom.composerOpacity);
  $('#skin-composer-opacity-value').textContent = `${custom.composerOpacity}%`;
  const preview = $('#skin-preview');
  preview.style.color = custom.textColor || '';
  preview.style.backgroundImage = custom.backgroundImage
    ? `linear-gradient(${hexOverlay(custom.backgroundOverlayColor, custom.backgroundOpacity)}, ${hexOverlay(custom.backgroundOverlayColor, custom.backgroundOpacity)}), url("${fileUrl(custom.backgroundImage)}")`
    : '';
  document.querySelectorAll('.skin-range-row').forEach((row) => {
    const range = row.querySelector('input[type="range"]');
    const number = row.querySelector('.skin-number-input');
    if (range && number) number.value = range.value;
  });
}

function addPrecisionInputs() {
  document.querySelectorAll('.skin-dialog input[type="range"]').forEach((range) => {
    if (range.dataset.precisionReady) return;
    range.dataset.precisionReady = 'true';
    const row = document.createElement('div');
    row.className = 'skin-range-row';
    const number = document.createElement('input');
    number.className = 'skin-number-input';
    number.type = 'number';
    number.min = range.min;
    number.max = range.max;
    number.step = range.step || '1';
    number.value = range.value;
    number.setAttribute('aria-label', `${range.closest('label')?.childNodes[0]?.textContent?.trim() || '参数'}数值`);
    range.replaceWith(row);
    row.append(range, number);
    const sync = (value) => {
      const next = Math.max(Number(range.min), Math.min(Number(range.max), Number(value)));
      if (!Number.isFinite(next)) return;
      range.value = String(next);
      number.value = String(next);
      range.dispatchEvent(new Event('input', { bubbles: true }));
    };
    range.addEventListener('input', () => { number.value = range.value; });
    number.addEventListener('change', () => sync(number.value));
    number.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); sync(number.value); } });
  });
}

function openSkinDialog() {
  addPrecisionInputs();
  updateSkinDialog();
  $('#skin-dialog').showModal();
}

function closeSkinDialog(revert = true) {
  if (revert) applyCustomSkin(state.savedCustomSkin);
  if ($('#skin-dialog').open) $('#skin-dialog').close();
}

async function chooseSkinAsset(kind) {
  const selected = await window.studio.chooseSkinAsset(kind === 'font' ? 'font' : 'background');
  if (!selected) return;
  const property = { font: 'fontFile', background: 'backgroundImage', sidebar: 'sidebarImage', composer: 'composerImage' }[kind];
  state.customSkin = { ...state.customSkin, [property]: selected.path };
  applyCustomSkin(state.customSkin);
}

async function saveCustomSkin() {
  state.savedCustomSkin = await window.studio.saveSkin(state.customSkin);
  applyCustomSkin(state.savedCustomSkin);
  closeSkinDialog(false);
}

async function resetCustomSkin() {
  state.savedCustomSkin = await window.studio.resetSkin();
  applyCustomSkin(state.savedCustomSkin);
}

function setApprovalCard(approval = null) {
  state.pendingApproval = approval;
  const card = $('#approval-card');
  card.hidden = !approval;
  if (!approval) return;
  const payload = approval.payload || {};
  const detail = payload.description || payload.reason || payload.message || 'Hermes 请求执行一个需要确认的操作。';
  const command = payload.command || payload.preview || payload.detail || '';
  $('#approval-detail').textContent = detail;
  $('#approval-command').textContent = command;
  $('#approval-status').textContent = '等待选择';
  document.querySelectorAll('[data-approval-choice]').forEach((button) => { button.disabled = false; button.classList.remove('selected'); });
}

async function respondToApproval(choice) {
  if (!state.pendingApproval) return;
  const selected = document.querySelector(`[data-approval-choice="${choice}"]`);
  document.querySelectorAll('[data-approval-choice]').forEach((button) => { button.disabled = true; button.classList.toggle('selected', button === selected); });
  $('#approval-status').textContent = '正在提交…';
  try {
    const result = await window.studio.respondApproval(choice);
    if (!result.ok) throw new Error(result.error || '无法提交确认。');
    $('#approval-status').textContent = '已提交';
    appendLog(`确认已提交：${choice}\n`);
  } catch (error) {
    appendLog(`无法提交确认：${error.message}\n`, 'error');
    $('#approval-status').textContent = '提交失败，请重试';
    document.querySelectorAll('[data-approval-choice]').forEach((button) => { button.disabled = false; button.classList.remove('selected'); });
  }
}

function updateRunning(running) {
  state.running = running;
  sendButton.disabled = running;
  stopButton.disabled = !running;
  prompt.disabled = false;
  modelSelect.disabled = running;
  $('#import-files').disabled = running;
  runState.textContent = running ? '运行中' : '空闲';
  runState.classList.toggle('running', running);
}

function appendLog(text, kind = '') {
  state.output += text;
  if (state.output.length > 16000) state.output = state.output.slice(-16000);
  log.textContent = state.output || '等待 Hermes 输出…';
  log.parentElement.classList.toggle('has-error', kind === 'error');
  log.scrollTop = log.scrollHeight;
}

function extractImagePaths(text) {
  if (typeof text !== 'string' || !text) return [];
  const extensions = '(?:png|jpe?g|webp|gif)';
  const matches = [];
  const patterns = [
    new RegExp(`MEDIA:\\s*([^\\r\\n]+?\\.${extensions})(?=\\s|$)`, 'gi'),
    new RegExp(`"(?:image|host_image|agent_visible_image)"\\s*:\\s*"([^"\\r\\n]+?\\.${extensions})"`, 'gi'),
    new RegExp(`(\\/home\\/makoto\\/生成图片\\/[^\\r\\n]+?\\.${extensions})`, 'gi'),
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) matches.push(match[1].replace(/\\\\/g, '\\'));
  }
  return [...new Set(matches)].slice(0, 6);
}

async function appendImagePreviews(message, text) {
  const paths = extractImagePaths(text);
  message.article.querySelector('.message-images')?.remove();
  if (!paths.length) return;
  let previews = [];
  try { previews = await window.studio.loadImagePreviews(paths); } catch { return; }
  if (!previews.length || !message.article.isConnected) return;
  const grid = document.createElement('div');
  grid.className = 'message-images';
  for (const preview of previews) {
    const image = document.createElement('img');
    image.src = preview.dataUrl;
    image.alt = '生成图片';
    image.loading = 'lazy';
    image.title = preview.path;
    grid.append(image);
  }
  message.article.append(grid);
}

function createMessage(role, text) {
  const article = document.createElement('article');
  const isUser = role === 'user';
  article.className = `message ${isUser ? 'user' : 'assistant'}`;
  article.innerHTML = `<div class="message-meta"><span class="message-avatar" aria-hidden="true"><img src="assets/${isUser ? 'husband-avatar.png' : 'anjie-avatar.png'}" alt="" /></span><span class="message-label">${isUser ? '你' : 'Hermes'}</span></div><div class="message-body"></div>`;
  const body = article.querySelector('.message-body');
  body.textContent = text;
  const message = { article, body };
  if (!isUser) void appendImagePreviews(message, text);
  return message;
}

function addMessage(role, text, { scroll = true } = {}) {
  welcome.hidden = true;
  const message = createMessage(role, text);
  messages.append(message.article);
  if (scroll) message.article.scrollIntoView({ block: 'end', behavior: 'smooth' });
  return message;
}

function renderSessionList() {
  const list = $('#conversation-list');
  list.replaceChildren();
  if (!state.sessions.length) {
    const empty = document.createElement('p');
    empty.className = 'sidebar-empty';
    empty.textContent = '还没有对话。开始一个新对话吧。';
    list.append(empty);
    return;
  }

  for (const session of state.sessions) {
    const item = document.createElement('button');
    item.className = `history-item${session.id === state.activeSessionId ? ' active' : ''}`;
    item.title = session.title;
    item.disabled = state.loadingSession || state.running;
    item.setAttribute('aria-busy', String(state.loadingSession && session.id !== state.activeSessionId));
    item.innerHTML = '<span class="history-dot"></span><span class="history-title"></span>';
    item.querySelector('.history-title').textContent = session.title;
    item.addEventListener('click', () => selectSession(session.id));
    item.addEventListener('contextmenu', (event) => openSessionMenu(event, session.id));
    list.append(item);
  }
}

async function refreshSessions() {
  const result = await window.studio.listSessions();
  state.sessions = Array.isArray(result.sessions) ? result.sessions : [];
  const requestedActiveId = result.activeSessionId || state.activeSessionId;
  state.activeSessionId = state.sessions.some((session) => session.id === requestedActiveId) ? requestedActiveId : null;
  renderSessionList();
}

function closeSessionMenu() {
  const menu = $('#session-menu');
  state.contextSessionId = null;
  menu.hidden = true;
}

function openSessionMenu(event, sessionId) {
  event.preventDefault();
  if (state.running || state.loadingSession) return;
  state.contextSessionId = sessionId;
  const menu = $('#session-menu');
  menu.hidden = false;
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

async function deleteContextSession() {
  const sessionId = state.contextSessionId;
  closeSessionMenu();
  if (!sessionId || state.running || state.loadingSession) return;
  const session = state.sessions.find((item) => item.id === sessionId);
  const title = session?.title || '这个对话';
  if (!window.confirm(`确定删除“${title}”？此操作无法撤销。`)) return;
  try {
    const result = await window.studio.deleteSession(sessionId);
    if (!result.ok) throw new Error(result.error || '无法删除对话。');
    if (state.activeSessionId === sessionId) {
      state.activeSessionId = null;
      state.assistant = null;
      messages.replaceChildren();
      welcome.hidden = false;
    }
    await refreshSessions();
  } catch (error) {
    appendLog(`无法删除对话：${error.message}\n`, 'error');
  }
}

function historyContent(entry) {
  if (!entry || typeof entry !== 'object') return '';
  if (typeof entry.content === 'string') return entry.content;
  if (typeof entry.text === 'string') return entry.text;
  if (typeof entry.message === 'string') return entry.message;
  return '';
}

function visibleHistoryEntries(entries) {
  const preferred = entries.filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant'));
  const candidates = preferred.length ? preferred : entries;
  const selected = [];
  let totalCharacters = 0;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const content = historyContent(candidates[index]);
    if (!content) continue;
    if (selected.length >= 80 || totalCharacters + content.length > 120000) break;
    selected.push(candidates[index]);
    totalCharacters += content.length;
  }
  return { entries: selected.reverse(), omitted: candidates.length - selected.length };
}

async function loadSessionMessages(sessionId) {
  const response = await window.studio.getSessionMessages(sessionId);
  if (!response?.ok) throw new Error(response?.error || '无法加载对话记录。');
  const entries = Array.isArray(response.payload?.data) ? response.payload.data : [];
  const history = visibleHistoryEntries(entries);
  const fragment = document.createDocumentFragment();
  let visibleMessages = 0;
  if (history.omitted > 0) {
    const notice = document.createElement('p');
    notice.className = 'history-truncated';
    notice.textContent = `为保证界面稳定，已省略较早的 ${history.omitted} 条记录。`;
    fragment.append(notice);
  }
  for (const entry of history.entries) {
    const role = entry.role === 'user' ? 'user' : 'assistant';
    const content = historyContent(entry);
    if (!content) continue;
    fragment.append(createMessage(role, content).article);
    visibleMessages += 1;
  }
  return { fragment, visibleMessages };
}

async function selectSession(sessionId) {
  if (state.running || state.loadingSession || sessionId === state.activeSessionId) return;
  state.loadingSession = true;
  renderSessionList();
  try {
    const loaded = await loadSessionMessages(sessionId);
    const selected = await window.studio.selectSession(sessionId);
    if (!selected.ok) throw new Error(selected.error || '无法切换对话。');
    state.activeSessionId = sessionId;
    const session = state.sessions.find((item) => item.id === sessionId);
    if (session?.model && [...modelSelect.options].some((option) => option.value === session.model)) modelSelect.value = session.model;
    state.assistant = null;
    messages.replaceChildren(loaded.fragment);
    welcome.hidden = loaded.visibleMessages > 0;
    $('#conversation').scrollTop = 0;
    renderSessionList();
    prompt.focus();
  } catch (error) {
    appendLog(`无法加载对话记录：${error.message}\n`, 'error');
  } finally {
    state.loadingSession = false;
    renderSessionList();
  }
}

async function startNewSession() {
  if (state.running) return;
  try {
    const created = await window.studio.newSession({ model: modelSelect.value });
    if (!created.ok || !created.sessionId) throw new Error(created.error || '无法创建新对话。');
    state.activeSessionId = created.sessionId;
    state.assistant = null;
    state.attachments = [];
    messages.replaceChildren();
    renderAttachments();
    welcome.hidden = false;
    await refreshSessions();
    renderSessionList();
    prompt.focus();
  } catch (error) {
    appendLog(`无法创建新对话：${error.message}\n`, 'error');
  }
}

function renderAttachments() {
  attachmentList.replaceChildren();
  attachmentList.hidden = state.attachments.length === 0;
  state.attachments.forEach((file, index) => {
    const tag = document.createElement('span');
    tag.className = 'attachment-tag';
    tag.innerHTML = `<span>▤</span><span></span><button title="移除文件">×</button>`;
    tag.children[1].textContent = file.name;
    tag.querySelector('button').addEventListener('click', () => {
      state.attachments.splice(index, 1);
      renderAttachments();
    });
    attachmentList.append(tag);
  });
}

function setAccountMode(registerMode) {
  state.registerMode = registerMode;
  $('#account-title').textContent = registerMode ? '创建账号' : '连接账号';
  $('#setup-code-row').hidden = !registerMode;
  $('#show-register').textContent = registerMode ? '返回登录' : '创建账号';
  $('#submit-account').textContent = registerMode ? '创建并连接' : '连接';
  $('#account-note').textContent = registerMode
    ? '首个账号可直接创建；后续账号需要管理员配对码。账号令牌受 Windows 凭据保护。'
    : '连接令牌受 Windows 凭据保护。Hermes API Key 永远不会发送到此应用。';
}

async function refreshStatus() {
  const status = await window.studio.getStatus();
  $('#profile-badge').textContent = status.connected ? status.username : '未连接';
  $('#connection-status').textContent = status.connected ? `${status.username} 已连接` : status.configured ? '账号登录已失效' : '需要账号连接';
  $('#status-dot').classList.toggle('offline', !status.connected);
  updateRunning(status.running);
}

function showAccountError(message = '') {
  const error = $('#account-error');
  error.hidden = !message;
  error.textContent = message;
}

function closeAccountDialog() {
  showAccountError();
  if (connectionDialog.open) connectionDialog.close();
}

async function openAccountDialog() {
  const account = await window.studio.getAccount();
  $('#account-base-url').value = account.accountBaseUrl;
  $('#account-username').value = account.username;
  $('#account-password').value = '';
  $('#setup-code').value = '';
  showAccountError();
  $('#account-form').hidden = account.configured;
  $('#account-signed-in').hidden = !account.configured;
  $('#signed-in-name').textContent = account.username || '当前设备';
  setAccountMode(false);
  connectionDialog.showModal();
}

async function importFiles() {
  const selected = await window.studio.chooseFiles();
  const known = new Set(state.attachments.map((file) => file.path));
  state.attachments.push(...selected.filter((file) => !known.has(file.path)));
  renderAttachments();
}

async function sendTask(value = prompt.value) {
  const task = value.trim();
  if ((!task && !state.attachments.length) || state.running) return;
  const displayTask = task || '请分析我导入的文件。';
  const model = modelSelect.value;
  const attachments = [...state.attachments];
  prompt.value = '';
  prompt.style.height = 'auto';
  addMessage('user', displayTask);
  state.output = '';
  state.assistant = addMessage('assistant', 'Thinking…');
  state.assistant.article.classList.add('thinking');
  appendLog('Hermes 正在处理任务…\n');
  state.taskStartedAt = Date.now();
  updateRunning(true);
  const response = await window.studio.runTask({ prompt: displayTask, attachments, model });
  state.attachments = [];
  renderAttachments();
  if (response.ok && response.sessionId) {
    state.activeSessionId = response.sessionId;
    await refreshSessions();
  }
  if (!response.ok && response.error !== 'Task stopped.') {
    appendLog(`${response.error}\n`, 'error');
    if (state.assistant) state.assistant.textContent = `任务没有启动：${response.error}`;
    updateRunning(false);
  }
}

$('#new-task').addEventListener('click', startNewSession);
$('#skin-toggle').addEventListener('click', cycleSkin);
$('#skin-settings').addEventListener('click', openSkinDialog);
$('#close-skin').addEventListener('click', () => closeSkinDialog());
$('#cancel-skin').addEventListener('click', () => closeSkinDialog());
$('#choose-skin-background').addEventListener('click', () => chooseSkinAsset('background').catch((error) => appendLog(`无法导入皮肤资源：${error.message}\n`, 'error')));
$('#choose-skin-font').addEventListener('click', () => chooseSkinAsset('font').catch((error) => appendLog(`无法导入皮肤资源：${error.message}\n`, 'error')));
$('#choose-skin-sidebar').addEventListener('click', () => chooseSkinAsset('sidebar').catch((error) => appendLog(`无法导入皮肤资源：${error.message}\n`, 'error')));
$('#choose-skin-composer').addEventListener('click', () => chooseSkinAsset('composer').catch((error) => appendLog(`无法导入皮肤资源：${error.message}\n`, 'error')));
$('#skin-text-color').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, textColor: event.target.value }));
$('#skin-accent-color').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, accentColor: event.target.value }));
$('#skin-opacity').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, backgroundOpacity: Number(event.target.value) }));
const extendedSkinControls = {
  'skin-name-input': { key: 'name', parse: (value) => value.slice(0, 48) },
  'skin-text-scale': { key: 'textScale', parse: Number },
  'skin-background-fit': { key: 'backgroundFit' }, 'skin-background-scale': { key: 'backgroundScale', parse: Number },
  'skin-background-overlay-color': { key: 'backgroundOverlayColor' }, 'skin-background-radius': { key: 'backgroundRadius', parse: Number }, 'skin-background-border-color': { key: 'backgroundBorderColor' }, 'skin-background-border-opacity': { key: 'backgroundBorderOpacity', parse: Number }, 'skin-background-blur': { key: 'backgroundBlur', parse: Number }, 'skin-background-shadow': { key: 'backgroundShadow', parse: Number },
  'skin-sidebar-text-scale': { key: 'sidebarTextScale', parse: Number }, 'skin-sidebar-position-x': { key: 'sidebarPositionX', parse: Number }, 'skin-sidebar-position-y': { key: 'sidebarPositionY', parse: Number }, 'skin-sidebar-fit': { key: 'sidebarFit' }, 'skin-sidebar-overlay-color': { key: 'sidebarOverlayColor' }, 'skin-sidebar-radius': { key: 'sidebarRadius', parse: Number }, 'skin-sidebar-border-color': { key: 'sidebarBorderColor' }, 'skin-sidebar-border-opacity': { key: 'sidebarBorderOpacity', parse: Number }, 'skin-sidebar-blur': { key: 'sidebarBlur', parse: Number }, 'skin-sidebar-shadow': { key: 'sidebarShadow', parse: Number },
  'skin-composer-text-scale': { key: 'composerTextScale', parse: Number }, 'skin-composer-position-x': { key: 'composerPositionX', parse: Number }, 'skin-composer-position-y': { key: 'composerPositionY', parse: Number }, 'skin-composer-fit': { key: 'composerFit' }, 'skin-composer-overlay-color': { key: 'composerOverlayColor' }, 'skin-composer-radius': { key: 'composerRadius', parse: Number }, 'skin-composer-border-color': { key: 'composerBorderColor' }, 'skin-composer-border-opacity': { key: 'composerBorderOpacity', parse: Number }, 'skin-composer-blur': { key: 'composerBlur', parse: Number }, 'skin-composer-shadow': { key: 'composerShadow', parse: Number },
};
Object.entries(extendedSkinControls).forEach(([id, binding]) => {
  $(`#${id}`).addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, [binding.key]: binding.parse ? binding.parse(event.target.value) : event.target.value }));
});
document.querySelectorAll('.skin-editor-tab').forEach((tab) => tab.addEventListener('click', () => {
  const panel = tab.dataset.skinPanel;
  document.querySelectorAll('.skin-editor-tab').forEach((item) => item.classList.toggle('active', item === tab));
  document.querySelectorAll('[data-skin-panel-content]').forEach((item) => { item.hidden = item.dataset.skinPanelContent !== panel; });
}));
$('#import-skin').addEventListener('click', async () => { const imported = await window.studio.importSkin(); if (imported) { state.savedCustomSkin = normalizeCustomSkin(imported); applyCustomSkin(state.savedCustomSkin); } });
$('#export-skin').addEventListener('click', () => window.studio.exportSkin(state.customSkin).catch((error) => appendLog(`无法导出皮肤：${error.message}\n`, 'error')));
$('#skin-position-x').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, backgroundPositionX: Number(event.target.value) }));
$('#skin-position-y').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, backgroundPositionY: Number(event.target.value) }));
$('#skin-sidebar-color').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, sidebarColor: event.target.value }));
$('#skin-sidebar-text-color').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, sidebarTextColor: event.target.value }));
$('#skin-sidebar-opacity').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, sidebarOpacity: Number(event.target.value) }));
$('#skin-composer-color').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, composerColor: event.target.value }));
$('#skin-composer-text-color').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, composerTextColor: event.target.value }));
$('#skin-composer-opacity').addEventListener('input', (event) => applyCustomSkin({ ...state.customSkin, composerOpacity: Number(event.target.value) }));
$('#skin-form').addEventListener('submit', (event) => { event.preventDefault(); saveCustomSkin().catch((error) => appendLog(`无法保存皮肤：${error.message}\n`, 'error')); });
$('#reset-skin').addEventListener('click', () => resetCustomSkin().catch((error) => appendLog(`无法重置皮肤：${error.message}\n`, 'error')));
$('#refresh-sessions').addEventListener('click', () => refreshSessions().catch((error) => appendLog(`无法刷新对话：${error.message}\n`, 'error')));
$('#delete-session').addEventListener('click', deleteContextSession);
document.querySelectorAll('[data-approval-choice]').forEach((button) => button.addEventListener('click', () => respondToApproval(button.dataset.approvalChoice)));
document.addEventListener('click', (event) => {
  if (!$('#session-menu').hidden && !$('#session-menu').contains(event.target)) closeSessionMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSessionMenu();
});
$('#clear-log').addEventListener('click', () => { state.output = ''; log.textContent = '活动记录已清除。'; });
$('#connection-settings').addEventListener('click', openAccountDialog);
$('#import-files').addEventListener('click', importFiles);
modelSelect.value = localStorage.getItem('hermes-studio-model') || 'gpt-5.6-terra';
modelSelect.addEventListener('change', () => localStorage.setItem('hermes-studio-model', modelSelect.value));
$('#show-register').addEventListener('click', () => { showAccountError(); setAccountMode(!state.registerMode); });
$('#cancel-account').addEventListener('click', closeAccountDialog);
$('#cancel-account-action').addEventListener('click', closeAccountDialog);
$('#switch-account').addEventListener('click', () => { $('#account-signed-in').hidden = true; $('#account-form').hidden = false; showAccountError(); setAccountMode(false); $('#account-password').focus(); });
$('#close-account').addEventListener('click', closeAccountDialog);
$('#logout-account').addEventListener('click', async () => { await window.studio.logout(); closeAccountDialog(); await refreshStatus(); });
$('#account-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = {
    accountBaseUrl: $('#account-base-url').value,
    username: $('#account-username').value,
    password: $('#account-password').value,
    setupCode: $('#setup-code').value,
  };
  try {
    showAccountError();
    const result = state.registerMode ? await window.studio.register(input) : await window.studio.login(input);
    if (!result?.ok) throw new Error(result?.error || '账号连接失败，请检查地址、账号和密码。');
    closeAccountDialog();
    await refreshStatus();
  } catch (error) {
    showAccountError(error.message || '账号连接失败，请检查地址、账号和密码。');
    appendLog(`${error.message}\n`, 'error');
  }
});
sendButton.addEventListener('click', () => sendTask());
stopButton.addEventListener('click', async () => { await window.studio.stopTask(); });
prompt.addEventListener('input', () => { prompt.style.height = 'auto'; prompt.style.height = `${Math.min(prompt.scrollHeight, 180)}px`; });
prompt.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    startNewSession();
    return;
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendTask();
  }
});
document.querySelectorAll('.suggestion').forEach((button) => button.addEventListener('click', () => sendTask(button.dataset.prompt)));

window.studio.onTaskEvent((event) => {
  const payload = event.payload || {};
  if (event.type === 'run.started') appendLog(`Hermes session: ${payload.session_id} · ${payload.model || modelSelect.value}\n\n`);
  if (event.type === 'run.model.resolved') appendLog(`实际后端：${payload.provider || 'unknown'} · ${payload.model || 'unknown'}\n`);
  if (event.type === 'assistant.delta') state.output += payload.delta || '';
  if (event.type === 'tool.started') appendLog('Hermes 正在执行步骤…\n');
  if (event.type === 'tool.completed') appendLog('Hermes 已完成一个步骤。\n');
  if (event.type === 'approval.request') {
    setApprovalCard(event);
    appendLog('Hermes 正在等待你的确认。\n');
  }
  if (event.type === 'approval.responded') setApprovalCard(null);
  if (event.type === 'error') { setApprovalCard(null); appendLog(`${event.text || payload.message || 'API error'}\n`, 'error'); if (state.assistant) { state.assistant.body.textContent = `任务未完成：${event.text || payload.message || '发生错误'}`; state.assistant.article.classList.remove('thinking'); } updateRunning(false); }
  if (event.type === 'run.stopped') { setApprovalCard(null); appendLog('任务已停止。\n'); if (state.assistant) { state.assistant.body.textContent = '任务已停止。'; state.assistant.article.classList.remove('thinking'); } updateRunning(false); }
  if (event.type === 'run.completed') {
    setApprovalCard(null);
    if (state.assistant) { const output = payload.output || state.output || '任务已完成。'; state.assistant.body.textContent = output; state.assistant.article.classList.remove('thinking'); void appendImagePreviews(state.assistant, output); }
    const elapsed = Math.max(1, Math.round((Date.now() - state.taskStartedAt) / 1000));
    appendLog(`\n任务完成 · ${elapsed}s\n`);
    updateRunning(false);
    refreshSessions().catch((error) => appendLog(`无法刷新对话：${error.message}\n`, 'error'));
  }
});

applySkin(localStorage.getItem('hermes-studio-skin') || 'warm-paper');
updateRunning(false);

window.studio.getSkin()
  .then((skin) => {
    state.savedCustomSkin = normalizeCustomSkin(skin);
    applyCustomSkin(state.savedCustomSkin);
  })
  .catch((error) => appendLog(`无法加载自定义皮肤：${error.message}\n`, 'error'));

refreshStatus()
  .then(() => refreshSessions())
  .catch((error) => { $('#connection-status').textContent = '无法读取运行状态'; appendLog(`${error.message}\n`, 'error'); });
