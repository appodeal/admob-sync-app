import {ipcMain, ipcRenderer, remote} from 'electron';
import {Action} from 'lib/actions';
import uuid from 'uuid';


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


export function onMessageFromMain<T = any> (channel: string, callback: (message: T) => void) {
    ipcRenderer.on(channel, (event, message) => {
        if (event.sender !== remote.getCurrentWindow().webContents) {
            callback(message);
        }
    });
}


function errorToJson (e: Error): string {
    const clone = {...e};
    ['name', 'message', 'stack', 'userMessage'].forEach(name => clone[name] = e[name]);
    return JSON.stringify(clone);
}
