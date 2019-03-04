import {app} from 'electron';
import fs from 'fs';
import path from 'path';


export function getJsonFile (fileName: string): Promise<any> {
    return new Promise(resolve => {
        fs.readFile(path.resolve(app.getPath('userData'), `./${fileName}.json`), (err, file) => {
            if (err) {
                resolve(null);
            } else {
                let json = file.toString();
                resolve(JSON.parse(json));
            }
        });
    });
}

export function saveJsonFile (fileName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.writeFile(path.resolve(app.getPath('userData'), `./${fileName}.json`), JSON.stringify(data), (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function deleteSession (sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.rmdir(path.resolve(app.getPath('userData'), `./Partitions/${sessionId}`), (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
