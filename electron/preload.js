import { contextBridge, ipcRenderer } from 'electron';

const api = {
  onJointUpdate(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('tcp-joint-update', listener);
    return () => ipcRenderer.removeListener('tcp-joint-update', listener);
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
  writeAutosave(scene) {
    return ipcRenderer.invoke('write-autosave', scene);
  },
  loadAutosave() {
    return ipcRenderer.invoke('load-autosave');
  },
  log(message) {
    ipcRenderer.send('log-info', message);
  }
};

contextBridge.exposeInMainWorld('api', api);
