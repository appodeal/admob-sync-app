import {AdmobApiService} from 'core/admob-api/admob.api';
import {AppodealApiService} from 'core/appodeal/api/appodeal.api';
import {BrowserWindow, ipcMain} from 'electron';
import {AdmobAccount, AppodealAccount} from 'interfaces/appodeal.interfaces';
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
                set<AppState>(this.state, 'adMobAccounts', [...this.state.adMobAccounts, account]);
                return account;
            });
    }
}
