import {AdmobApiService} from 'core/admob-api/admob.api';
import {AppodealApiService} from 'core/appodeal/api/appodeal.api';
import {BrowserWindow, ipcMain} from 'electron';
import {AdmobAccount, AppodealAccount} from 'interfaces/appodeal.interfaces';
import {getJsonFile, saveJsonFile} from 'lib/json-storage';
import {action, observable, observe, set} from 'mobx';


export interface SyncProgress {
    id: string;
    totalApps: number;
    completedApps: number;
    failedApps: number;
}

export interface AppState {
    appodealAccount: AppodealAccount;
    adMobAccounts: Array<AdmobAccount>;
    syncProgress: SyncProgress;
}


export class Store {
    static getAdmobAccounts (): Promise<Array<AdmobAccount>> {
        return getJsonFile('admob-accounts');
    }

    static saveAdmobAccounts (accounts: Array<AdmobAccount>): Promise<void> {
        return saveJsonFile('admob-accounts', accounts);
    }

    @observable readonly state: AppState = {
        appodealAccount: AppodealApiService.emptyAccount,
        adMobAccounts: [],
        syncProgress: null
    };

    constructor (
        private appodealApi: AppodealApiService,
        private adMobApi: AdmobApiService
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
    adMobSignIn () {
        return this.adMobApi.signIn()
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
    adMobRemoveAccount (accountId: string) {
        return this.adMobApi.removeAccount(accountId)
            .then(() => {
                let accounts = this.state.adMobAccounts.filter(acc => acc.id !== accountId);
                set<AppState>(this.state, 'adMobAccounts', accounts);
                return Store.saveAdmobAccounts(accounts);
            });
    }
}
