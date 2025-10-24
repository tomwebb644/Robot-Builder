import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'net';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
const tcpClients = new Set();

const isDev = !app.isPackaged;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexHtml = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexHtml);
  }
};

const parseMessage = (message) => {
  const trimmed = message.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch (error) {
    const pairs = trimmed.split(/[,;\n]+/);
    const result = {};
    let matched = false;
    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split(/[:=]/);
      if (!rawKey || rawValue === undefined) continue;
      const key = rawKey.trim();
      const value = Number(rawValue.trim());
      if (!Number.isNaN(value)) {
        result[key] = value;
        matched = true;
      }
    }
    return matched ? result : null;
  }
};

const startTCPServer = () => {
  const server = createServer((socket) => {
    tcpClients.add(socket);
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const chunk = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const payload = parseMessage(chunk);
        if (payload && mainWindow) {
          mainWindow.webContents.send('tcp-joint-update', payload);
        }
        newlineIndex = buffer.indexOf('\n');
      }
    });

    socket.on('end', () => {
      if (buffer.length > 0) {
        const payload = parseMessage(buffer);
        if (payload && mainWindow) {
          mainWindow.webContents.send('tcp-joint-update', payload);
        }
        buffer = '';
      }
      tcpClients.delete(socket);
    });

    socket.on('close', () => {
      tcpClients.delete(socket);
    });

    socket.on('error', () => {
      tcpClients.delete(socket);
    });
  });

  const port = 5555;
  server.listen(port, () => {
    console.log(`TCP server listening on port ${port}`);
  });
  server.on('error', (error) => {
    console.error('TCP server error', error);
  });
};

app.whenReady().then(() => {
  createWindow();
  startTCPServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('set-joint-value', (_event, payload) => {
  const message = JSON.stringify(payload);
  for (const client of tcpClients) {
    if (!client.destroyed) {
      client.write(message + '\n');
    }
  }
});

ipcMain.handle('save-scene', async (_event, scene) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Robot Scene',
    defaultPath: path.join(app.getPath('documents'), 'robot-scene.json'),
    filters: [{ name: 'Robot Scene', extensions: ['json'] }]
  });
  if (canceled || !filePath) {
    return { success: false };
  }
  await fs.writeFile(filePath, JSON.stringify(scene, null, 2), 'utf-8');
  return { success: true, filePath };
});

ipcMain.handle('load-scene', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Load Robot Scene',
    filters: [{ name: 'Robot Scene', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || filePaths.length === 0) {
    return { success: false };
  }
  const content = await fs.readFile(filePaths[0], 'utf-8');
  return { success: true, scene: JSON.parse(content) };
});

ipcMain.on('log-info', (_event, message) => {
  console.log('[Renderer]', message);
});
