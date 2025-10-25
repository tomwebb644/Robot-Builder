import { contextBridge, ipcRenderer } from 'electron';

const api = {
  connectTcp(options) {
    return ipcRenderer.invoke('tcp-connect', options);
  },
  disconnectTcp() {
    return ipcRenderer.invoke('tcp-disconnect');
  },
  getTcpStatus() {
    return ipcRenderer.invoke('tcp-status-current');
  },
  sendJointState(payload) {
    ipcRenderer.send('send-joint-state', payload);
  },
  onTcpStatus(callback) {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('tcp-status', listener);
    return () => {
      ipcRenderer.removeListener('tcp-status', listener);
    };
  }
};

contextBridge.exposeInMainWorld('simulatorAPI', api);

window.dispatchEvent(new Event('simulator-api-ready'));
