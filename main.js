import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProxyServer } from './src/server.js';
import { DEFAULT_PORT } from './src/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let proxyServer;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        icon: path.join(__dirname, 'public/images/acroxy-icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        // Frameless-ish premium look
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#e07b62',
            symbolColor: '#ffffff',
            height: 32
        },
        backgroundColor: '#e07b62',
        show: false,
    });

    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'electron-ui/dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

const PORT = process.env.PORT || DEFAULT_PORT;
proxyServer = new ProxyServer(PORT);

ipcMain.handle('proxy:start', async () => {
    try {
        await proxyServer.start();
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('proxy:stop', async () => {
    try {
        await proxyServer.stop();
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('proxy:status', () => {
    return {
        running: !!proxyServer.server,
        port: proxyServer.port
    };
});

ipcMain.on('win:minimize', () => {
    mainWindow.minimize();
});

ipcMain.on('win:maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('win:close', () => {
    mainWindow.close();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Ensure proxy stops when app quits
app.on('before-quit', async () => {
    if (proxyServer) {
        await proxyServer.stop();
    }
});
