import {configureScope} from '@sentry/electron';
import compareVersions from 'compare-versions';
import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {OnlineService} from 'core/appdeal-api/online.service';
import {SyncHistory, SyncHistoryInfo} from 'core/sync-apps/sync-history';
import {SyncEvent, SyncEventsTypes, SyncReportProgressEvent} from 'core/sync-apps/sync.events';
import {BrowserWindow, Notification} from 'electron';
import {getAppVersion} from 'lib/about';
import {ActionTypes} from 'lib/actions';
import {AppPreferences, Preferences} from 'lib/app-preferences';
import {deepAssign} from 'lib/core';
import {onActionFromRenderer} from 'lib/messages';
import {openSettingsWindow} from 'lib/settings';
import {getLogsList, LogFileInfo} from 'lib/sync-logs/logger';
import {confirmDialog, messageDialog, openWindow, waitForNavigation} from 'lib/window';
import {action, observable, observe, set} from 'mobx';
import reSignIn = AdMobSessions.reSignIn;


export interface SyncProgress {
    id: string;
    totalApps: number;
    completedApps: number;
    failedApps: number;
    percent: number;
    lastEvent: SyncEventsTypes.ReportProgress | SyncEventsTypes.CalculatingProgress | SyncEventsTypes.Started | SyncEventsTypes.Stopped;
}

export interface AppState {
    selectedAccount: {
        account: AppodealAccount | AdMobAccount;
        logs: LogFileInfo[];
    }
    appodealAccount: AppodealAccount;
    syncHistory: Record<AccountID, SyncHistoryInfo>;
    syncProgress: Record<AccountID, SyncProgress | undefined>;
    preferences: AppPreferences;
    online: boolean;
    outdatedVersion: boolean;
    nextReconnect: number;
}

type AccountID = string;

const ONE_MINUTE = 60 * 1000;


export class Store {

    @observable readonly state: AppState = {
        selectedAccount: {
            account: AppodealApiService.emptyAccount,
            logs: []
        },
        appodealAccount: AppodealApiService.emptyAccount,
        syncHistory: {},
        syncProgress: {},
        preferences: null,
        online: false,
        outdatedVersion: false,
        nextReconnect: 0
    };

    updatedID;
    pingTimer;

    constructor (
        private appodealApi: AppodealApiService,
        private onlineService: OnlineService,
        preferences: AppPreferences
    ) {
        set(this.state, 'preferences', preferences);
        onActionFromRenderer('store', action => {
            switch (action.type) {
            case ActionTypes.getStore:
                return this.emitState();
            }
        });
        observe(this.state, () => this.emitState());
        this.watchOnlineStatus();
    }

    private watchOnlineStatus () {
        this.onlineService.whenOnline().subscribe(() => {
            clearTimeout(this.pingTimer);
            set<AppState>(this.state, 'online', true);
        });
        this.onlineService.whenOffline().subscribe(() => {
            set<AppState>(this.state, 'online', false);
            // right now we are trying to reconnect
            set<AppState>(this.state, 'nextReconnect', Date.now());
            return this.pingAppodeal();
        });
    }

    @action
    pingAppodeal () {
        clearTimeout(this.pingTimer);

        return this.onlineService.sendPing(false)
            .then(
                () => this.appodealFetchUser(),
                () => {
                    set<AppState>(this.state, 'nextReconnect', Date.now() + ONE_MINUTE);
                    this.pingTimer = setTimeout(() => this.pingAppodeal(), ONE_MINUTE);
                }
            );
    }


    private emitState () {
        BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('store', JSON.stringify(this.state));
        });
    }

    async updateAdmobAccountsInfo (appodealAccount: AppodealAccount | null) {
        const accounts: AdMobAccount[] = appodealAccount ? appodealAccount.accounts : [];

        const histories = await Promise.all(accounts.map(account => SyncHistory.getHistory(account)));

        const syncHistory = accounts.reduce((acc, account, index) => {
            acc[account.id] = histories[index];
            return acc;
        }, {});

        set<AppState>(this.state, 'syncHistory', {...(this.state.syncHistory || {}), ...syncHistory});
    }

    async updateAdMobAccountInfo (account: Pick<AdMobAccount, 'id'>) {
        const history = await SyncHistory.getHistory(account);
        set<AppState>(this.state, 'syncHistory', {...(this.state.syncHistory || {}), [account.id]: history});
    }


    async validateAppVersion () {
        if (this.state.outdatedVersion) {
            return false;
        }

        const minimalVersion = await this.appodealApi.getMinimalAppVersion();
        if (compareVersions(minimalVersion, getAppVersion()) !== 1) {
            console.log(`Minimal app version ${minimalVersion}. OK.`);
            // everything is ok
            return true;
        }
        console.warn(`Minimal app version ${minimalVersion}. Current one is ${getAppVersion()}.`);
        this.notifyThatAppOutdated();

        return false;
    }

    notifyThatAppOutdated () {
        if (this.state.outdatedVersion) {
            // already notified
            return false;
        }
        set<AppState>(this.state, 'outdatedVersion', true);
        // notify user
        let notification = new Notification({
            title: 'AdMob Sync is outdated ',
            body: `AdMob Sync is outdated. Please update it to be able to sync your apps.`
        });
        notification.once('click', () => {
            notification.close();
            openSettingsWindow();
        });
        notification.once('close', () => {
            notification = null;
        });
        notification.show();
    }

    isSyncing () {
        return Object.values(this.state.syncProgress).filter(Boolean).length !== 0;
    }

    hasWarnings () {
        return this.state.outdatedVersion || this.state.appodealAccount.accounts
            .map(account => this.state.syncHistory[account.id])
            .filter(Boolean)
            .map(v => v.admobAuthorizationRequired)
            .some(Boolean);
    }

    isEachAccountSynced () {
        return this.state.appodealAccount.accounts
            .map(account => this.state.syncHistory[account.id])
            .map(info => (info && info.lastSuccessfulSync))
            .every(Boolean);
    }

    @action
    fireSyncUpdated () {
        if (this.updatedID) {
            return;
        }
        this.updatedID = setTimeout(() => {
            this.updatedID = null;
            set<AppState>(this.state, 'syncProgress', {...this.state.syncProgress});
        }, 500);
    }

    @action
    updateSyncProgress (account: AdMobAccount, event: SyncEvent) {
        switch (event.type) {
        case SyncEventsTypes.Started:
        case SyncEventsTypes.CalculatingProgress:
            this.state.syncProgress[event.accountId] = {
                id: event.id,
                totalApps: 0,
                completedApps: 0,
                failedApps: 0,
                percent: 0,
                lastEvent: event.type
            };
            return this.fireSyncUpdated();
        case SyncEventsTypes.ReportProgress:
            const pEvent = <SyncReportProgressEvent>event;
            this.state.syncProgress[event.accountId] = {
                id: event.id,
                totalApps: pEvent.total,
                completedApps: pEvent.synced,
                failedApps: pEvent.failed,
                percent: (pEvent.synced + pEvent.failed) / pEvent.total * 100,
                lastEvent: event.type
            };
            return this.fireSyncUpdated();
        case SyncEventsTypes.Stopped:
            delete this.state.syncProgress[event.accountId];
            this.fireSyncUpdated();
            return this.updateAdMobAccountInfo(account);
        }
    }

    @action
    appodealSignIn (email: string, password: string): Promise<AppodealAccount> {
        return this.appodealApi.signIn(email, password)
            .then(() => this.appodealApi.fetchCurrentUser())
            .then(account => this.setAppodealAccount(account));
    }

    @action
    appodealFetchUser (): Promise<AppodealAccount> {
        return this.appodealApi.fetchCurrentUser().then(account => this.setAppodealAccount(account));

    }

    @action
    appodealSignOut (): Promise<AppodealAccount> {
        return this.appodealApi.signOut()
            .then(() => this.setAppodealAccount(AppodealApiService.emptyAccount));
    }

    @action
    async selectAccount (account: AppodealAccount | AdMobAccount) {
        set<AppState>(this.state, 'selectedAccount', {
            account: account,
            logs: this.state.selectedAccount.account.id === account.id ? this.state.selectedAccount.logs : []
        });
        // we dont need to wait while logs are loading
        // we want provide quick response to UI
        // once log-list is loaded - we will show it
        if (this.state.appodealAccount.id !== account.id) {
            const logs = await this.loadSelectedAdMobAccountLogs(<AdMobAccount>account);
            if (this.state.selectedAccount.account.id === account.id) {
                set<AppState>(this.state, 'selectedAccount', {
                    account: account,
                    logs
                });
            }
        }
    }

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
    setAdMobCredentials ({accountId, clientId, clientSecret}: { accountId: string, clientId: string, clientSecret: string }) {
        return this.appodealApi.setAdMobAccountCredentials(accountId, clientId, clientSecret)
            .then(async oAuthUrl => {
                let window = await openWindow(oAuthUrl, {
                    frame: true,
                    titleBarStyle: 'default',
                    width: 400,
                    minWidth: 400,
                    webPreferences: {
                        session: AdMobSessions.getSession(accountId)
                    }
                });
                if (environment.development) {
                    window.webContents.once('login', async (event, request, authInfo, callback) => {
                        let {login, password} = environment.basicAuth;
                        callback(login, password);
                    });
                }
                await waitForNavigation(window, /\/admob_plugin\/api\/v3\/oauth\/success/);
                window.close();
            })
            .then(() => this.appodealApi.fetchCurrentUser())
            .then(account => this.setAppodealAccount(account));
    }

    @action
    async setAppodealAccount (account) {
        await this.updateAdmobAccountsInfo(account);
        configureScope(scope => {
            scope.setUser(account);
            scope.setExtra('syncHistory', this.state.syncHistory);
        });
        set<AppState>(this.state, 'appodealAccount', account);
        return account;
    }

    @action
    async reSignInAdmob (currentAccount: AdMobAccount) {
        const resultAccount = await reSignIn(currentAccount);
        if (!resultAccount) {
            return;
        }
        if (resultAccount.id === currentAccount.id) {
            return await this.updateAdMobAccountInfo(currentAccount);
        }

        const existedAccount = this.state.appodealAccount.accounts.find(account => account.id === resultAccount.id);
        if (existedAccount) {
            messageDialog(`You were supposed to sign in ${currentAccount.email}, but you have signed in another account ${resultAccount.email}. Try again to sign In.`);
            return;
        }

        const addAccount = await confirmDialog(
            `You were supposed to sign in ${currentAccount.email}, but you have signed in another account ${resultAccount.email}.
Do you what to add new Account (${resultAccount.email})?`
        );

        if (addAccount) {
            // user signed in with new account
            // question
            console.log(`adding new account ${resultAccount.email}`);

            if (await this.appodealApi.addAdMobAccount(resultAccount)) {
                return await this.appodealFetchUser();
            }
            return this.updateAdMobAccountInfo(currentAccount);
        }

        console.log(`cancel adding new account. delete session`);

    }

    @action
    async patchPreferences (patch: { [P in keyof AppPreferences]: Partial<AppPreferences[P]> }) {
        set<AppState>(this.state, 'preferences', deepAssign({...this.state.preferences}, patch));
        await Preferences.save(this.state.preferences);
    }

}
