import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {Sync} from 'core/sync-apps/sync';
import {ExtractedAdmobAccount} from 'interfaces/common.interfaces';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import path from 'path';


export interface SyncHistoryInfo {
    lastSync: number
    lastSuccessfulSync: number;
    admobAuthorizationRequired: boolean
}


type AdmobAccount = Pick<AdMobAccount, 'id'> | Pick<ExtractedAdmobAccount, 'id'>;


export class SyncHistory {

    private static fileName (admobAccount: AdmobAccount) {
        return path.join(`sync-history`, admobAccount.id);
    }

    private static cache = new Map<string, SyncHistoryInfo>();

    private static async loadHistory (adMobAccount: AdmobAccount): Promise<SyncHistoryInfo> {
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

    private static async saveHistory (adMobAccount: AdmobAccount): Promise<void> {
        await saveJsonFile(SyncHistory.fileName(adMobAccount), await SyncHistory.loadHistory(adMobAccount));
    }

    public static async setAuthorizationRequired (adMobAccount: AdmobAccount, required = true) {
        const history = await SyncHistory.loadHistory(adMobAccount);
        history.admobAuthorizationRequired = required;
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

    public static async getHistory (adMobAccount: AdmobAccount): Promise<SyncHistoryInfo> {
        const history = await SyncHistory.loadHistory(adMobAccount);
        return {...history};
    }

    public static async getLastSync (adMobAccount: AdmobAccount): Promise<Date | null> {
        const history = await SyncHistory.loadHistory(adMobAccount);
        return SyncHistory.msTimeToDate(history.lastSync);
    }

    public static async getLastSussesfullSync (adMobAccount: AdmobAccount): Promise<Date | null> {
        const history = await SyncHistory.loadHistory(adMobAccount);
        return SyncHistory.msTimeToDate(history.lastSuccessfulSync);
    }

}
