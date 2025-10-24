const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('robotAPI', {
  setJointValue: (payload) => {
    if (!payload || typeof payload.name !== 'string') {
      return;
    }
    ipcRenderer.send('joint:setValue', payload);
  },
  onJointUpdate: (callback) => {
    if (typeof callback !== 'function') {
      return () => undefined;
    }
    const subscription = (_event, updates) => {
      callback(updates);
    };
    ipcRenderer.on('joint:update', subscription);
    return () => {
      ipcRenderer.removeListener('joint:update', subscription);
    };
  },
  onTcpStatus: (callback) => {
    if (typeof callback !== 'function') {
      return () => undefined;
    }
    const subscription = (_event, status) => {
      callback(status);
    };
    ipcRenderer.on('tcp:status', subscription);
    return () => {
      ipcRenderer.removeListener('tcp:status', subscription);
    };
  },
  requestInitialJointState: () => ipcRenderer.invoke('joint:getState')
});
