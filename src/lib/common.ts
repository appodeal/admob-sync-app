import {BrowserWindow, BrowserWindowConstructorOptions, ipcMain, ipcRenderer} from 'electron';
import {Action} from 'lib/actions';
import path from 'path';
import uuid from 'uuid';
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
    onclose: (window?: BrowserWindow) => void = () => undefined
): Promise<BrowserWindow> {
    return new Promise(resolve => {
        let window = new BrowserWindow(getConfig(config, getBgColor())),
            changeTheme = async theme => {
                window.setBackgroundColor(getBgColor());
                return window.webContents.executeJavaScript(createScript(theme => {
                    document.documentElement.classList.toggle('dark', theme === 'dark');
                    document.documentElement.classList.toggle('light', theme === 'light');
                }, theme));
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
            if (!(typeof config.show === 'boolean' && !config.show)) {
                window.show();
            }
            resolve(window);
        });

        window.once('close', () => {
            stopListenThemeChange();
            ipcMain.removeListener('windowControl', commandListener);
            onclose(window);
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
                sender.send(`${channel}:response:${id}`, {error: errorToJson(error), result: null});
            });
    });
}

export function sendToMain (channel: string, action: Action) {
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

export function getRandomNumberString (length: number): string {
    let digits = new Array(length);
    for (let i = 0; i < length; i++) {
        digits[i] = Math.round(Math.random() * 10);
    }
    return digits.join('');
}

export function goToPage (window: BrowserWindow, filePathOrUrl: string) {
    if (/^https?:\/\/[^\/]+/i.test(filePathOrUrl)) {
        window.loadURL(filePathOrUrl);
    } else {
        window.loadFile(filePathOrUrl);
    }
    return waitForNavigation(window, filePathOrUrl);
}

export function waitForNavigation (window: BrowserWindow, urlFragment: string = null): Promise<void> {
    return new Promise(resolve => {
        let resolver = () => {
            window.webContents.once('dom-ready', () => resolve());
        };
        if (urlFragment) {
            let checker = new RegExp(`^${urlFragment.replace(/[\.\?]/g, match => `\\${match}`)}`, 'i');
            window.webContents.on('did-navigate', (_, address) => {
                if (checker.test(address)) {
                    window.webContents.removeAllListeners('did-navigate');
                    resolver();
                }
            });
        } else {
            window.webContents.once('did-navigate', () => {
                resolver();
            });
        }

    });
}


