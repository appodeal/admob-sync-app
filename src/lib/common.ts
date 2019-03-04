import {BrowserWindow, BrowserWindowConstructorOptions, ipcMain, ipcRenderer} from 'electron';
import {Action} from 'lib/actions';
import path from 'path';
import uuid from 'uuid/v1';
import {getBgColor, getCurrentTheme, onThemeChanges} from './theme';

function getConfig (config: BrowserWindowConstructorOptions, backgroundColor: string): BrowserWindowConstructorOptions {
    return {
        width: 700,
        height: 550,
        minWidth: 700,
        minHeight: 550,
        frame: false,
        titleBarStyle: 'hiddenInset',
        fullscreenWindowTitle: false,
        backgroundColor,
        ...config,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            ...(config.webPreferences || {})
        }
    };
}

export function openWindow (
    filePathOrUrl: string,
    config: BrowserWindowConstructorOptions = {},
    onclose: () => void = () => undefined
): Promise<BrowserWindow> {
    return new Promise(resolve => {
        let window = new BrowserWindow(getConfig(config, getBgColor())),
            changeTheme = async theme => {
                window.setBackgroundColor(getBgColor());
                return window.webContents.executeJavaScript(`(${(theme => {
                    document.documentElement.classList.toggle('dark', theme === 'dark');
                    document.documentElement.classList.toggle('light', theme === 'light');
                }).toString()})('${theme}');`);
            },
            stopListenThemeChange = onThemeChanges(mode => {
                changeTheme(mode);
            }),
            commandListener = (event, command) => {
                if (event.sender === window.webContents) {
                    setTimeout(() => window[command]());
                }
            };

        if (/^https?:\/\/[^\/]+/i.test(filePathOrUrl)) {
            window.loadURL(filePathOrUrl);
        } else {
            window.loadFile(filePathOrUrl);
        }

        ipcMain.on('windowControl', commandListener);

        window.webContents.once('dom-ready', async () => {
            await changeTheme(getCurrentTheme());
            window.show();
            resolve(window);
        });

        window.once('close', () => {
            stopListenThemeChange();
            ipcMain.removeListener('windowControl', commandListener);
            onclose();
        });

    });
}

export function getPath (filePath: string = '') {
    return path.join(environment.development ? './' : process.resourcesPath, filePath);
}

export function onActionFromRenderer (channel: string, cb: (action: Action) => void) {
    ipcMain.on(channel, ({sender}, {id, action}: { id: string, action: Action }) => {
        Promise.resolve()
            .then(() => cb(action))
            .then(result => {
                sender.send(`${channel}:response:${id}`, {error: null, result});
            })
            .catch(error => {
                sender.send(`${channel}:response:${id}`, {error, result: null});
            });
    });
}

export function sendToMain (channel: string, action: Action) {
    return new Promise((resolve, reject) => {
        let id = uuid();
        ipcRenderer.send(channel, {id, action});
        ipcRenderer.once(`${channel}:response:${id}`, (event, {error, result}) => {
            if (result) {
                resolve(result);
            } else {
                reject(error);
            }
        });
    });

}

export function createScript (fn: (...args: Array<any>) => void, ...args) {
    return `(async function (argsJson) {
    let args = JSON.parse(argsJson);
    return (${fn.toString()})(...args);
    })('${JSON.stringify(args)}')`;
}


