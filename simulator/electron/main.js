import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let tcpClient = null;
let currentStatus = 'disconnected';
let currentMessage = undefined;

const isDev = !app.isPackaged;

const broadcastStatus = (status, message) => {
  currentStatus = status;
  currentMessage = message;
  if (mainWindow) {
    mainWindow.webContents.send('tcp-status', { status, message });
  }
};

const disposeTcpClient = (notify = true) => {
  if (tcpClient) {
    tcpClient.removeAllListeners();
    try {
      tcpClient.destroy();
    } catch (error) {
      // ignore
    }
    tcpClient = null;
  }
  if (notify) {
    broadcastStatus('disconnected');
  }
};

const connectTcp = ({ host, port }) =>
  new Promise((resolve) => {
    disposeTcpClient(false);
    const socket = new net.Socket();
    tcpClient = socket;
    broadcastStatus('connecting');

    socket.setNoDelay(true);

    const handleConnect = () => {
      broadcastStatus('connected');
      resolve({ success: true });
    };

    const handleError = (error) => {
      const message = error instanceof Error ? error.message : String(error);
      broadcastStatus('error', message);
      disposeTcpClient(false);
      resolve({ success: false, error: message });
    };

    socket.once('connect', handleConnect);
    socket.once('error', handleError);
    socket.once('close', () => {
      broadcastStatus('disconnected');
      disposeTcpClient(false);
    });

    socket.connect(port, host);
  });

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#040711',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5183');
  } else {
    const indexHtml = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexHtml);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  createWindow();
  broadcastStatus(currentStatus, currentMessage);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      broadcastStatus(currentStatus, currentMessage);
    }
  });
});

app.on('window-all-closed', () => {
  disposeTcpClient(false);
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('tcp-connect', async (_event, options) => {
  const host = typeof options?.host === 'string' && options.host.trim() ? options.host.trim() : '127.0.0.1';
  const port = Number(options?.port) || 5555;
  const result = await connectTcp({ host, port });
  if (!result.success) {
    broadcastStatus('error', result.error);
  }
  return result;
});

ipcMain.handle('tcp-disconnect', async () => {
  disposeTcpClient();
});

ipcMain.on('send-joint-state', (_event, payload) => {
  if (!payload || typeof payload !== 'object' || !tcpClient || tcpClient.destroyed) {
    return;
  }
  try {
    const message = JSON.stringify(payload);
    tcpClient.write(message + '\n');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    broadcastStatus('error', message);
    disposeTcpClient(false);
  }
});
