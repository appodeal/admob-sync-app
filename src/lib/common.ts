import {BrowserWindow, BrowserWindowConstructorOptions, dialog, ipcMain, ipcRenderer, remote} from 'electron';
import {Action} from 'lib/actions';
import path from 'path';
import uuid from 'uuid';
import {getBgColor} from './theme';


function getConfig (config: BrowserWindowConstructorOptions, backgroundColor: string): BrowserWindowConstructorOptions {
    return {
        width: 750,
        height: 550,
        minWidth: 750,
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
    onclose: (window?: BrowserWindow) => void = () => undefined
): Promise<BrowserWindow> {
    return new Promise(resolve => {
        let window = new BrowserWindow(getConfig(config, getBgColor())),
            commandListener = (event, command) => {
                if (event.sender === window.webContents) {
                    setTimeout(() => window[command]());
                }
            },
            readyListener = async () => {
                if (!(typeof config.show === 'boolean' && !config.show)) {
                    window.show();
                }
                resolve(window);
            };

        if (/^https?:\/\/[^\/]+/i.test(filePathOrUrl)) {
            window.loadURL(filePathOrUrl);
            window.once('ready-to-show', readyListener);
        } else {
            window.loadFile(filePathOrUrl);
            window.webContents.once('dom-ready', readyListener);
        }

        ipcMain.on('windowControl', commandListener);

        window.once('close', () => {
            ipcMain.removeListener('windowControl', commandListener);
            onclose(window);
        });

    });
}

export function getPath (filePath: string = '') {
    return path.join(environment.development ? './' : process.resourcesPath, filePath);
}

export function onActionFromRenderer (channel: string, cb: (action: Action) => void): Function {
    let listener = ({sender}, {id, action}: { id: string, action: Action }) => {
        Promise.resolve()
            .then(() => cb(action))
            .then(result => {
                sender.send(`${channel}:response:${id}`, {error: null, result});
            })
            .catch(error => {
                sender.send(`${channel}:response:${id}`, {error: errorToJson(error), result: null});
            });
    };
    ipcMain.on(channel, listener);
    return () => ipcMain.removeListener(channel, listener);
}

export function sendToMain<T> (channel: string, action: Action): Promise<T> {
    return new Promise((resolve, reject) => {
        let id = uuid.v4();
        ipcRenderer.send(channel, {id, action});
        ipcRenderer.once(`${channel}:response:${id}`, (event, {error, result}) => {
            if (error) {
                reject(JSON.parse(error));
            } else {
                resolve(result);
            }
        });
    });

}

export function errorToJson (e: Error): string {
    const clone = {...e};
    ['name', 'message', 'stack', 'userMessage'].forEach(name => clone[name] = e[name]);
    return JSON.stringify(clone);
}

export function createScript (fn: (...args: Array<any>) => void, ...args) {
    return `(async function (...args) {
    let safeJsonParse = json => {
        let result;
        try {
            result = JSON.parse(json);
        } catch (e) {
            result = json;
        }
        return result; 
    };
    return (${fn.toString()})(...args.map(arg => {
        if (typeof arg === 'function') {
            return arg;
        } else {
            return safeJsonParse(arg);
        }
    }));
    })(${args.map(arg => {
        if (typeof arg === 'function') {
            return arg.toString();
        } else if (typeof arg === 'string') {
            return `'${arg}'`;
        } else {
            return `'${JSON.stringify(arg)}'`;
        }
    }).join(', ')})`;
}

export function waitForNavigation (window: BrowserWindow, urlFragment: RegExp = null): Promise<void> {
    return new Promise(resolve => {
        if (urlFragment) {
            window.webContents.on('did-navigate', (_, address) => {
                if (urlFragment.test(address)) {
                    window.webContents.removeAllListeners('did-navigate');
                    resolve();
                }
            });
        } else {
            window.webContents.once('did-navigate', () => {
                resolve();
            });
        }

    });
}

export function confirmDialog (message) {
    return new Promise<boolean>(resolve => {
        const OKButton = 0;

        const dialogOptions = {type: 'question', buttons: ['OK', 'Cancel'], message};

        (dialog || remote.dialog).showMessageBox(dialogOptions, i => {
            if (i === OKButton) {

                return resolve(true);
            }
            return resolve(false);
        });
    });
}

export function messageDialog (message: string, detail: string = undefined) {
    (dialog || remote.dialog).showMessageBox({
        message,
        detail
    });
}


