import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {BrowserWindow, ipcMain} from 'electron';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import {getLogsList, LogFileInfo} from 'lib/sync-logs/logger';
import {action, observable, observe, set} from 'mobx';


export interface SyncProgress {
    id: string;
    totalApps: number;
    completedApps: number;
    failedApps: number;
}

export interface AppState {
    appodealAccount: AppodealAccount;
    adMobAccounts: Array<AdMobAccount>;
    syncProgress: SyncProgress;
}


export class Store {

    @observable readonly state: AppState = {
        appodealAccount: AppodealApiService.emptyAccount,
        adMobAccounts: [],
        syncProgress: null
    };

    constructor (
        private appodealApi: AppodealApiService
    ) {
        ipcMain.on('store', () => this.emitState());
        observe(this.state, () => this.emitState());
    }

    private emitState () {
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('store', JSON.stringify(this.state));
        });
    }

    @action
    appodealSignIn (email: string, password: string): Promise<AppodealAccount> {
        return this.appodealApi.signIn(email, password)
            .then(() => this.appodealApi.fetchCurrentUser())
            .then(account => {
                set<AppState>(this.state, 'appodealAccount', account);
                return account;
            });
    }

    @action
    appodealFetchUser (): Promise<AppodealAccount> {
        return this.appodealApi.fetchCurrentUser()
            .then(account => {
                set<AppState>(this.state, 'appodealAccount', account);
                return account;
            });

    }

    @action
    appodealSignOut (): Promise<AppodealAccount> {
        return this.appodealApi.signOut()
            .then(() => {
                set<AppState>(this.state, 'appodealAccount', AppodealApiService.emptyAccount);
                return AppodealApiService.emptyAccount;
            });
    }

    @action
    loadSelectedAdMobAccountLogs (account: AdMobAccount): Promise<LogFileInfo[]> {
        return getLogsList(account).catch(e => {
            console.error(e);
            return [];
        });
    }

    @action
    async addAdMobAccount () {
        let account = await AdMobSessions.signIn();
        if (account) {
            let existingAccount = this.state.appodealAccount.accounts.find(acc => acc.id === account.id);
            if (!existingAccount) {
                let added = await this.appodealApi.addAdMobAccount(account);
                if (added) {
                    await this.appodealFetchUser();
                    return {
                        existingAccount: null,
                        newAccount: account
                    };
                } else {
                    throw new Error(`Can't create AdMob account`);
                }
            }
            return {
                existingAccount,
                newAccount: null
            };
        }
        return {
            existingAccount: null,
            newAccount: null
        };
    }

    @action
    setAdMobCredentials ({accountId, clientId, clientSecret}: {accountId: string, clientId: string, clientSecret: string}) {
        return this.appodealApi.setAdMobAccountCredentials(accountId, clientId, clientSecret)
            .then(account => {
                set<AppState>(this.state, 'appodealAccount', account);
                return account;
            });
    }
}
