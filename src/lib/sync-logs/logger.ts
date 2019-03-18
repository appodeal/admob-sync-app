import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {app} from 'electron';
import fs from 'fs-extra';
import {patchLogger} from 'lib/sync-logs/patch-logger';

import path from 'path';
import * as winston from 'winston';
import {Logger} from 'winston';


export interface LoggerInstance extends Logger {
    /**
     * @deprecated use closeAsync instead
     */
    close (): Logger;
    closeAsync: () => Promise<void>;
}

export interface LogFileInfo {
    uuid: string
    fileName: string;
    /**
     * created time
     * miliseconds
     */
    ctime: number;
}

function sortFilesByCreatedDate (dir, fileNames): LogFileInfo[] {
    console.debug('sortFilesByCreatedDate', dir);
    const namePattern = /^\S{36}.log$/;
    return fileNames
        .filter(v => namePattern.test(v))
        .map(v => <LogFileInfo>({
                fileName: v,
                uuid: v.replace('.log', ''),
                ctime: fs.statSync(path.join(dir, v)).ctime.getTime()
            })
        ).sort((a, b) => b.ctime - a.ctime);
}

export function getLogsDirectory (adMobAccount: AdMobAccount) {
    return path.join(
        app.getPath('userData'),
        'sync-logs',
        adMobAccount.id
    );

}

function logFilePathName (adMobAccount: AdMobAccount, syncId: string) {
    return path.join(getLogsDirectory(adMobAccount), `${syncId}.log`);
}

const readableLogFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({level, message, timestamp}) => `${timestamp} [${level.toUpperCase()}] ${message}`)
);

export async function createSyncLogger (adMobAccount: AdMobAccount, syncId: string) {

    const dirPath = getLogsDirectory(adMobAccount);
    await fs.ensureDir(dirPath);

    return patchLogger(winston.createLogger({
        level: 'info',
        format: readableLogFormat,
        defaultMeta: {service: 'sync'},
        transports: [
            new winston.transports.Console({level: 'info'}),
            new winston.transports.File({filename: logFilePathName(adMobAccount, syncId), level: 'info'})
        ]
    }));
}

export async function getLogContent (adMobAccount: AdMobAccount, syncId) {
    return fs.readFile(logFilePathName(adMobAccount, syncId)).then(buffer => buffer.toString());
}


export async function getLogsList (adMobAccount: AdMobAccount): Promise<LogFileInfo[]> {

    return new Promise((resolve, reject) => {
        const dir = getLogsDirectory(adMobAccount);
        console.debug('getLogsDirectory', dir);
        if (!fs.existsSync(dir)) {
            console.debug('logs dir not found');
            return resolve([]);
        }
        fs.readdir(dir, (err, files) => {
            if (err) {
                console.error(err);
                return reject(err);
            }

            resolve(sortFilesByCreatedDate(dir, files || []));
        });
    });

}

export async function rotateSyncLogs (adMobAccount: AdMobAccount, maxCount = 20) {

    try {
        const path = getLogsDirectory(adMobAccount);
        console.debug('getLogsDirectory', path);
        return rotateLogs(path, maxCount);
    } catch (e) {
        console.error(`FAILED To Make logs rotation for adMobAccount ${adMobAccount.id}`);
        console.error(e);
    }
}


async function rotateLogs (dir: string, maxCount = 20) {
    if (!fs.existsSync(dir)) {
        console.debug('logs dir not found');
        return;
    }
    const files = fs.readdirSync(dir);
    if (files.length < maxCount) {
        console.debug('limit not exceed');
        return;
    }

    return Promise.all(sortFilesByCreatedDate(dir, files)
        .slice(maxCount)
        .map(f => fs.unlink(path.join(dir, f.fileName)))
    );

}
