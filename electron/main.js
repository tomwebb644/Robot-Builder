const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const net = require('net');

const TCP_PORT = Number.parseInt(process.env.ROBOT_TCP_PORT || '5555', 10);
const jointState = {};
const tcpClients = new Set();
let mainWindow;
let tcpServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 720,
    backgroundColor: '#10121a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    mainWindow.loadURL(devServer);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexHtml);
  }
}

function parseMessage(rawMessage) {
  if (!rawMessage) {
    return null;
  }

  const trimmed = rawMessage.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    // fall through to delimited parsing
  }

  const updates = {};
  let hasUpdates = false;
  const segments = trimmed.split(/[,;\n]+/);
  for (const segment of segments) {
    const [key, value] = segment.split(/[:=]/).map((entry) => entry?.trim()).filter(Boolean);
    if (!key || value === undefined) {
      continue;
    }
    const numericValue = Number.parseFloat(value);
    if (Number.isFinite(numericValue)) {
      updates[key] = numericValue;
      hasUpdates = true;
    }
  }

  return hasUpdates ? updates : null;
}

function forwardJointUpdateToRenderer(updates) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('joint:update', updates);
}

function forwardJointUpdateToClients(updates, ignoreSocket) {
  const payload = `${JSON.stringify(updates)}\n`;
  for (const socket of tcpClients) {
    if (socket.destroyed || socket === ignoreSocket) {
      continue;
    }
    socket.write(payload);
  }
}

function notifyTcpStatus(status, message) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send('tcp:status', { status, message });
}

function setupTcpServer() {
  if (tcpServer) {
    return;
  }

  tcpServer = net.createServer((socket) => {
    tcpClients.add(socket);
    notifyTcpStatus('connected');

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString('utf8');

      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const message = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const updates = parseMessage(message);
        if (updates) {
          Object.assign(jointState, updates);
          forwardJointUpdateToRenderer(updates);
          forwardJointUpdateToClients(updates, socket);
        }
        newlineIndex = buffer.indexOf('\n');
      }
    });

    socket.on('error', (error) => {
      notifyTcpStatus('error', error.message);
    });

    socket.on('close', () => {
      tcpClients.delete(socket);
      notifyTcpStatus(tcpClients.size > 0 ? 'connected' : 'listening');
    });
  });

  tcpServer.on('error', (error) => {
    notifyTcpStatus('error', error.message);
  });

  tcpServer.listen(TCP_PORT, () => {
    notifyTcpStatus('listening');
  });
}

app.whenReady().then(() => {
  createWindow();
  setupTcpServer();

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

ipcMain.on('joint:setValue', (_event, payload) => {
  const { name, value } = payload || {};
  if (typeof name !== 'string' || typeof value !== 'number' || Number.isNaN(value)) {
    return;
  }
  jointState[name] = value;
  forwardJointUpdateToClients({ [name]: value });
});

ipcMain.handle('joint:getState', () => ({ ...jointState }));
