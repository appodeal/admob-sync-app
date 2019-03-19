import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {Sync} from 'core/sync-apps/sync';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import * as path from 'path';


export interface SyncHistoryInfo {
    lastSync: number
    lastSuccessfulSync: number;
    admobAuthorizationRequired: boolean
}


export class SyncHistory {

    private static fileName (admobAccount: AdMobAccount) {
        return path.join(`sync-history`, admobAccount.id);
    }

    private static cache = new Map<string, SyncHistoryInfo>();

    private static async loadHistory (adMobAccount: AdMobAccount): Promise<SyncHistoryInfo> {
        if (!SyncHistory.cache.has(adMobAccount.id)) {
            const data = <SyncHistoryInfo>await getJsonFile(SyncHistory.fileName(adMobAccount));
            SyncHistory.cache.set(adMobAccount.id, data || {
                lastSync: null,
                lastSuccessfulSync: null,
                admobAuthorizationRequired: true
            });
        }

        return Promise.resolve(SyncHistory.cache.get(adMobAccount.id));
    }

    private static async saveHistory (adMobAccount: AdMobAccount): Promise<void> {
        await saveJsonFile(SyncHistory.fileName(adMobAccount), await SyncHistory.loadHistory(adMobAccount));
    }

    public static async setAuthorizationRequired (adMobAccount: AdMobAccount) {
        const history = await SyncHistory.loadHistory(adMobAccount);
        history.admobAuthorizationRequired = true;
        await SyncHistory.saveHistory(adMobAccount);
    }

    public static async logSyncEnd (sync: Sync) {
        const history = await SyncHistory.loadHistory(sync.adMobAccount);
        const time = Date.now();
        history.lastSync = time;
        if (!sync.hasErrors) {
            history.lastSuccessfulSync = time;
        }
        await SyncHistory.saveHistory(sync.adMobAccount);
    }

    public static msTimeToDate (ms: number): Date | null {
        if (ms) {
            return new Date(ms);
        }
        return null;
    }

    public static async getHistory (adMobAccount: AdMobAccount): Promise<SyncHistoryInfo> {
        const history = await SyncHistory.loadHistory(adMobAccount);
        return {...history};
    }

    public static async getLastSync (adMobAccount: AdMobAccount): Promise<Date | null> {
        const history = await SyncHistory.loadHistory(adMobAccount);
        return SyncHistory.msTimeToDate(history.lastSync);
    }

    public static async getLastSussesfullSync (adMobAccount: AdMobAccount): Promise<Date | null> {
        const history = await SyncHistory.loadHistory(adMobAccount);
        return SyncHistory.msTimeToDate(history.lastSuccessfulSync);
    }

}
