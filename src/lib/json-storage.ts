import {app} from 'electron';
import fs from 'fs-extra';
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
        const fullPath = path.resolve(app.getPath('userData'), `./${fileName}.json`);
        fs.ensureDir(path.dirname(fullPath));
        fs.writeFile(fullPath, JSON.stringify(data), (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
