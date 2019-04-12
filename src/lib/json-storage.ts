import {app} from 'electron';
import fs from 'fs-extra';
import path from 'path';


export function getJsonFile<T = any> (fileName: string, defaultData?: any): Promise<T> {
    let args = [...arguments];
    return new Promise(resolve => {
        fs.readFile(path.resolve(app.getPath('userData'), `./${fileName}.json`), async (err, file) => {
            let result;
            if (err) {
                result = undefined;
            } else {
                try {
                    result = JSON.parse(file.toString());
                } catch (e) {
                    result = undefined;
                }
            }
            if (result === undefined && args.length === 2) {
                await saveJsonFile(fileName, defaultData);
                result = defaultData;
            }
            resolve(result);
        });
    });
}

export function saveJsonFile (fileName: string, data: any): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const fullPath = path.resolve(app.getPath('userData'), `./${fileName}.json`);
        await fs.ensureDir(path.dirname(fullPath));
        fs.writeFile(fullPath, JSON.stringify(data), (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
