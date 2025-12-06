const { app, Tray, Menu, BrowserWindow, ipcMain, nativeImage, globalShortcut } = require('electron');
const path = require('path');

let Store = null;
let store = null;
let currentConfig = {
  enabled: true,
  mode: 'single',
  width: 5,
  opacity: 0.8,
  fadeTime: 1000,
  color: '#ff0000',
  gradientColors: ['#ff0000', '#00ff00'],
  preset: 0,
  gradientLength: 100,
  gradientTransition: 0.5,
  shortcutEnabled: true, // 快捷键开关，默认为true
  autoStart: false, // 开机自启开关，默认为false
  theme: 'light' // 主题，默认为light
};

let tray = null;
let mainWindow = null;
let trailWindow = null;
let settingsWindow = null;

// 在应用准备就绪时动态导入 electron-store
app.whenReady().then(async () => {
  try {
    const module = await import('electron-store');
    Store = module.default;
    
    // 创建配置存储
    store = new Store({
      name: 'mouse-trail-config',
      defaults: {
        enabled: true,
        mode: 'single',
        width: 5,
        opacity: 0.8,
        fadeTime: 1000,
        color: '#ff0000',
        gradientColors: ['#ff0000', '#00ff00'],
        preset: 0,
        gradientLength: 100,
        gradientTransition: 0.5,
        shortcutEnabled: true,
        autoStart: false,
        theme: 'light'
      }
    });
    
    // 加载保存的配置
    currentConfig = store.get();
    
    // 如果轨迹窗口已创建，发送配置
    if (trailWindow) {
      trailWindow.webContents.send('update-config', currentConfig);
    }
    
    // 如果主窗口已创建，发送配置
    if (mainWindow) {
      mainWindow.webContents.send('load-config', currentConfig);
    }
  } catch (error) {
    console.error('Failed to load electron-store:', error);
  }
});

// 移除默认菜单
Menu.setApplicationMenu(null);

// 创建系统托盘
function createTray() {
  // 使用 icon.png 创建托盘图标
  const iconPath = path.join(__dirname, 'icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  // 创建托盘实例
  tray = new Tray(trayIcon);
  
  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: showMainWindow
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => app.quit()
    }
  ]);
  
  // 设置托盘提示文本
  tray.setToolTip('Curove');
  
  // 设置托盘菜单
  tray.setContextMenu(contextMenu);
  
  // 双击托盘显示主窗口
  tray.on('double-click', showMainWindow);
}

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 520,
    frame: false,
    transparent: false,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'icon.png')
  });
  
  // 加载主页面
  mainWindow.loadFile('index.html');
  
  // 主窗口加载完成后发送保存的配置
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('load-config', currentConfig);
  });
  
  // 窗口关闭时隐藏而非销毁
  mainWindow.on('close', (event) => {
    event.preventDefault();
    hideMainWindow();
  });
}

// 显示主窗口
function showMainWindow() {
  // 先关闭透明层
  if (trailWindow) {
    trailWindow.hide();
  }
  
  // 关闭设置窗口
  if (settingsWindow) {
    settingsWindow.hide();
  }
  
  // 创建或显示主窗口
  if (!mainWindow) {
    createMainWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// 隐藏主窗口
function hideMainWindow() {
  if (mainWindow) {
    mainWindow.hide();
    
    // 主窗口隐藏后，重新打开透明层
    if (trailWindow) {
      trailWindow.show();
    }
  }
}

// 设置窗口功能已合并到主窗口中，移除了相关函数

// 创建轨迹窗口
function createTrailWindow() {
  // 获取屏幕尺寸
  const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;
  
  // 创建全屏透明窗口
  trailWindow = new BrowserWindow({
    width: width,
    height: height,
    transparent: true,
    frame: false,
    show: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });
  
  // 设置窗口忽略鼠标事件，但转发鼠标移动事件
  trailWindow.setIgnoreMouseEvents(true, { forward: true });
  
  // 设置窗口始终在最上面，使用 screen-saver 层级，这是 Electron 中最高的窗口层级之一
  trailWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // 监听窗口的 focus 事件，确保窗口始终保持在最上面
  trailWindow.on('blur', () => {
    trailWindow.setAlwaysOnTop(true, 'screen-saver');
  });
  
  // 定期检查并重新设置 alwaysOnTop，确保窗口始终在最上面
  setInterval(() => {
    if (trailWindow) {
      trailWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  }, 1000);
  
  // 加载轨迹页面
  trailWindow.loadFile('trail.html');
  
  // 轨迹窗口加载完成后发送保存的配置
  trailWindow.webContents.on('did-finish-load', () => {
    trailWindow.webContents.send('update-config', currentConfig);
  });
  
  // 窗口关闭时处理
  trailWindow.on('closed', () => {
    trailWindow = null;
  });
}

// 应用准备就绪事件
app.whenReady().then(async () => {
  try {
    // 动态导入 electron-store
    const module = await import('electron-store');
    Store = module.default;
    
    // 创建配置存储
    store = new Store({
      name: 'mouse-trail-config',
      defaults: {
        enabled: true,
        mode: 'single',
        width: 5,
        opacity: 0.8,
        fadeTime: 1000,
        color: '#ff0000',
        gradientColors: ['#ff0000', '#00ff00'],
        preset: 0,
        gradientLength: 100,
        gradientTransition: 0.5,
        shortcutEnabled: true,
        autoStart: false,
        theme: 'light'
      }
    });
    
    // 加载保存的配置
    currentConfig = store.get();
    
    console.log('加载的配置:', currentConfig);
    
    // 应用开机自启设置
    app.setLoginItemSettings({
        openAtLogin: currentConfig.autoStart === true,
        openAsHidden: true // 开机时隐藏主窗口
    });
    
    // 创建系统托盘
    createTray();
    
    // 创建并自动开启透明层和轨迹
    createTrailWindow();
    
    // 注册全局快捷键 Shift+Alt+W
    const ret = globalShortcut.register('Shift+Alt+W', () => {
        console.log('Global shortcut Shift+Alt+W pressed');
        // 如果主窗口存在且可见，忽略快捷键触发
        if (mainWindow && mainWindow.isVisible()) {
            console.log('Main window is visible, ignoring shortcut');
            return;
        }
        if (trailWindow) {
            // 移除透明层
            console.log('Destroying trail window');
            trailWindow.destroy();
            trailWindow = null;
        } else {
            // 重新创建透明层
            console.log('Creating new trail window');
            createTrailWindow();
            // 确保立即发送最新配置
            if (trailWindow && trailWindow.webContents) {
                trailWindow.webContents.send('update-config', currentConfig);
            }
        }
    });
    
    if (ret) {
        console.log('Global shortcut registered successfully');
    } else {
        console.log('Failed to register global shortcut');
    }
    
    // 监听窗口激活事件（macOS）
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createTray();
            createTrailWindow();
        }
    });
  } catch (error) {
    console.error('Failed to load electron-store:', error);
  }
});

// 所有窗口关闭事件
app.on('window-all-closed', () => {
    // 保持应用运行在系统托盘中，不要退出
    // 注释掉默认的退出逻辑，这样应用程序会一直运行在系统托盘中
    // if (process.platform !== 'darwin') {
    //     app.quit();
    // }
});

// 在应用退出前注销全局快捷键
app.on('will-quit', () => {
    console.log('Unregistering global shortcut');
    globalShortcut.unregisterAll();
});

// 监听进程退出事件
app.on('before-quit', () => {
  // 确保所有窗口都被销毁
  if (mainWindow) {
    mainWindow.destroy();
  }
  if (trailWindow) {
    trailWindow.destroy();
  }
});

// 监听轨迹配置更新
ipcMain.on('update-trail-config', (event, config) => {
  // 保存配置到存储（如果 store 已加载）
  if (store) {
    store.set(config);
  }
  
  currentConfig = config;
  
  if (trailWindow) {
    trailWindow.webContents.send('update-config', config);
  }
});

// 监听轨迹开关控制
ipcMain.on('toggle-trail', (event, enabled) => {
  if (trailWindow) {
    trailWindow.webContents.send('toggle-trail', enabled);
  }
});

// 监听窗口控制事件
ipcMain.on('minimize-window', () => {
  hideMainWindow();
});

ipcMain.on('close-window', () => {
  hideMainWindow();
});

// 移除了设置窗口事件，设置功能已合并到主窗口中
// 移除了渲染进程转发的快捷键事件，改为使用全局快捷键

// 监听开机自启设置更新
ipcMain.on('update-autostart', (event, enabled) => {
    console.log('Updating autostart setting:', enabled);
    
    // 保存配置到存储（如果 store 已加载）
    if (store) {
        store.set('autoStart', enabled);
    }
    
    currentConfig.autoStart = enabled;
    
    // 应用开机自启设置
    app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true
    });
});
