const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studio', {
  getStatus: () => ipcRenderer.invoke('studio:status'),
  getAccount: () => ipcRenderer.invoke('studio:account'),
  login: (input) => ipcRenderer.invoke('studio:login', input),
  register: (input) => ipcRenderer.invoke('studio:register', input),
  logout: () => ipcRenderer.invoke('studio:logout'),
  listSessions: () => ipcRenderer.invoke('studio:list-sessions'),
  getSessionMessages: (sessionId) => ipcRenderer.invoke('studio:get-session-messages', sessionId),
  deleteSession: (sessionId) => ipcRenderer.invoke('studio:delete-session', sessionId),
  newSession: (input) => ipcRenderer.invoke('studio:new-session', input),
  selectSession: (sessionId) => ipcRenderer.invoke('studio:select-session', sessionId),
  chooseFiles: () => ipcRenderer.invoke('studio:choose-files'),
  loadImagePreviews: (paths) => ipcRenderer.invoke('studio:load-image-previews', paths),
  getSkin: () => ipcRenderer.invoke('studio:get-skin'),
  saveSkin: (input) => ipcRenderer.invoke('studio:save-skin', input),
  resetSkin: () => ipcRenderer.invoke('studio:reset-skin'),
  exportSkin: (input) => ipcRenderer.invoke('studio:export-skin', input),
  importSkin: () => ipcRenderer.invoke('studio:import-skin'),
  chooseSkinAsset: (kind) => ipcRenderer.invoke('studio:choose-skin-asset', kind),
  runTask: (input) => ipcRenderer.invoke('studio:run-task', input),
  respondApproval: (choice) => ipcRenderer.invoke('studio:respond-approval', choice),
  stopTask: () => ipcRenderer.invoke('studio:stop-task'),
  onTaskEvent: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('studio:task-event', handler);
    return () => ipcRenderer.removeListener('studio:task-event', handler);
  },
});
