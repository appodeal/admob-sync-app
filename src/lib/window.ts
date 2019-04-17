import {BrowserWindow, BrowserWindowConstructorOptions, dialog, ipcMain, remote} from 'electron';
import {getBgColor} from './theme';


function getConfig (config: BrowserWindowConstructorOptions, backgroundColor: string): BrowserWindowConstructorOptions {
    return {
        width: 800,
        height: 550,
        minWidth: 800,
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
        } else {
            window.loadFile(filePathOrUrl);
        }
        window.webContents.once('dom-ready', readyListener);

        ipcMain.on('windowControl', commandListener);

        window.once('closed', () => {
            ipcMain.removeListener('windowControl', commandListener);
            onclose(window);
        });
    });
}


export function openDialogWindow<T = any> (
    filePath: string,
    {width, height, parent}: { width: number, height: number, parent: BrowserWindow },
    afterOpen?: (window?: BrowserWindow) => void
): Promise<T> {
    return new Promise(async resolve => {
        let returnValue,
            window = await openWindow(filePath, {
                width,
                height,
                minWidth: width,
                minHeight: height,
                resizable: false,
                frame: true,
                fullscreenable: false,
                minimizable: false,
                maximizable: false,
                titleBarStyle: 'default',
                center: true,
                parent
            }, () => {
                ipcMain.removeListener('returnValue', valueListener);
                resolve(returnValue);
            }),
            valueListener = (event, value) => {
                if (event.sender === window.webContents) {
                    returnValue = value;
                }
            };
        ipcMain.on('returnValue', valueListener);
        window.setAlwaysOnTop(!!parent, 'normal');
        if (typeof afterOpen === 'function') {
            afterOpen(window);
        }
    });
}

export function waitForNavigation (window: BrowserWindow, urlFragment: RegExp = null): Promise<void> {
    return new Promise(resolve => {
        let resolver = () => {
            window.webContents.once('dom-ready', () => resolve());
        };
        if (urlFragment) {
            window.webContents.on('did-navigate', (_, address) => {
                if (urlFragment.test(address)) {
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

interface DialogButton {
    label: string;
    action?: () => void;
    primary?: boolean;
    cancel?: boolean;
}

export function messageDialog (
    message: string,
    detail: string = undefined,
    buttons: Array<DialogButton> = [{label: 'OK', action: () => {}, primary: true, cancel: true}]
): Promise<DialogButton> {
    return new Promise(resolve => {
        (dialog || remote.dialog).showMessageBox({
            message,
            detail,
            buttons: buttons.map(btn => btn.label),
            cancelId: buttons.findIndex(btn => btn.cancel),
            defaultId: buttons.findIndex(btn => btn.primary)
        }, number => {
            resolve(buttons[number]);
        });
    });

}


