import { contextBridge, ipcRenderer } from 'electron';

const api = {
  onJointUpdate(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('tcp-joint-update', listener);
    return () => ipcRenderer.removeListener('tcp-joint-update', listener);
  },
  onTcpStatus(callback) {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('tcp-status', listener);
    return () => ipcRenderer.removeListener('tcp-status', listener);
  },
  sendJointValue(payload) {
    ipcRenderer.send('set-joint-value', payload);
  },
  saveScene(scene) {
    return ipcRenderer.invoke('save-scene', scene);
  },
  loadScene() {
    return ipcRenderer.invoke('load-scene');
  },
  log(message) {
    ipcRenderer.send('log-info', message);
  }
};

contextBridge.exposeInMainWorld('api', api);
