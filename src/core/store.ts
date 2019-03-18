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
    static getAdmobAccounts (): Promise<Array<AdMobAccount>> {
        return getJsonFile('admob-accounts');
    }

    static saveAdmobAccounts (accounts: Array<AdMobAccount>): Promise<void> {
        return saveJsonFile('admob-accounts', accounts);
    }

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

        Store.getAdmobAccounts().then(accounts => {
            set<AppState>(this.state, 'adMobAccounts', accounts || []);
        });
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
                set<AppState>(this.state, 'adMobAccounts', account.accounts || []);
                return account;
            });

    }

    @action
    appodealSignOut (): Promise<AppodealAccount> {
        return this.appodealApi.signOut()
            .then(() => {
                set<AppState>(this.state, 'appodealAccount', AppodealApiService.emptyAccount);
                set<AppState>(this.state, 'adMobAccounts', []);
                return AppodealApiService.emptyAccount;
            });
    }

    @action
    loadSelectedAdMobAccountLogs (account: AdMobAccount): Promise<LogFileInfo[]> {
        if (!account) {
            return Promise.resolve([]);
        }
        return getLogsList(account).catch(e => {
            console.error(e);
            return [];
        });
    }

    @action
    adMobSignIn () {
        return AdMobSessions.signIn()
            .then(account => {
                if (account) {
                    let existingAccount = this.state.adMobAccounts.find(acc => acc.id === account.id),
                        accounts;
                    if (existingAccount) {
                        Object.assign(existingAccount, account);
                        accounts = [...this.state.adMobAccounts];
                    } else {
                        accounts = [...this.state.adMobAccounts, account];
                    }
                    set<AppState>(this.state, 'adMobAccounts', accounts);
                    Store.saveAdmobAccounts(accounts);
                }
                return account;
            });
    }

    @action
    adMobRemoveAccount (account: AdMobAccount) {
        return AdMobSessions.removeSession(account)
            .then(() => {
                let accounts = this.state.adMobAccounts.filter(acc => acc.id !== account.id);
                set<AppState>(this.state, 'adMobAccounts', accounts);
                return Store.saveAdmobAccounts(accounts);
            });
    }

    @action
    setAdMobCredentials ({accountId, clientId, clientSecret}: {accountId: string, clientId: string, clientSecret: string}) {
        return this.appodealApi.setAdMobAccountCredentials(accountId, clientId, clientSecret)
            .then(account => {
                set<AppState>(this.state, 'appodealAccount', account);
                set<AppState>(this.state, 'adMobAccounts', account.accounts || []);
                return account;
            });
    }
}
