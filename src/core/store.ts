import {configureScope} from '@sentry/electron';
import compareVersions from 'compare-versions';
import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AppodealApi} from 'core/appdeal-api/appodeal-api.factory';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {OnlineService} from 'core/appdeal-api/online.service';
import {SyncHistory, SyncHistoryInfo} from 'core/sync-apps/sync-history';
import {SyncEvent, SyncEventsTypes, SyncReportProgressEvent} from 'core/sync-apps/sync.events';
import {BrowserWindow, Notification} from 'electron';
import {AppodealAccountState, UserAccount} from 'interfaces/common.interfaces';
import {getAppVersion} from 'lib/about';
import {ActionTypes} from 'lib/actions';
import {AppPreferences, Preferences} from 'lib/app-preferences';
import {deepAssign} from 'lib/core';
import {onActionFromRenderer} from 'lib/messages';
import {getLogsList, LogFileInfo} from 'lib/sync-logs/logger';
import {openSettingsWindow} from 'lib/ui-windows';
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
        account: AdMobAccount;
        logs: LogFileInfo[];
    }
    selectedAppodealAccount: AppodealAccount;
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
            account: null,
            logs: []
        },
        selectedAppodealAccount: null,
        syncHistory: {},
        syncProgress: {},
        preferences: null,
        online: false,
        outdatedVersion: false,
        nextReconnect: 0
    };

    private appodealAccounts: Map<string, AppodealAccount>;

    updatedID;
    pingTimer;

    constructor (
        private appodealApi: AppodealApi,
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
                () => this.fetchAllAppodealUsers(),
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

        const minimalVersion = await this.appodealApi.getDefault().getMinimalAppVersion();
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
        if (!this.state.selectedAppodealAccount) {
            return false;
        }
        return this.state.outdatedVersion || this.state.selectedAppodealAccount.accounts
            .map(account => this.state.syncHistory[account.id])
            .filter(Boolean)
            .map(v => v.admobAuthorizationRequired)
            .some(Boolean);
    }

    isEachAccountSynced () {
        if (!this.state.selectedAppodealAccount) {
            return false;
        }
        return this.state.selectedAppodealAccount.accounts
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
    async pushLogs (account: AdMobAccount, logs?: Array<LogFileInfo>) {
        logs = Array.isArray(logs) ? logs : await this.loadSelectedAdMobAccountLogs(account);
        let selectedAccount = this.state.selectedAccount.account;
        if (account && selectedAccount && account.id === selectedAccount.id) {
            set(this.state, 'selectedAccount', {
                logs,
                account
            });
        }
    }

    @action
    updateSyncProgress (account: AdMobAccount, event: SyncEvent) {
        switch (event.type) {
        case SyncEventsTypes.Started:
            this.pushLogs(account);
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
            .then(account => this.addAppodealAccount(account))
            .then(account => this.selectAppodealAccount(account));
    }

    @action
    appodealSignOut (accountId: string): Promise<AppodealAccount> {
        return this.appodealApi.signOut(accountId)
            .then(async () => {
                this.appodealAccounts.delete(accountId);
                let accountIndex = 0,
                    updatedAccounts = this.state.preferences.accounts.appodealAccounts.filter((acc, index) => {
                        if (acc.id === accountId) {
                            accountIndex = index;
                        }
                        return acc.id !== accountId;
                    });
                await this.patchPreferences({
                    accounts: {
                        appodealAccounts: updatedAccounts
                    }
                });
                return updatedAccounts[accountIndex] || updatedAccounts[accountIndex - 1] || null;
            })
            .then(accState => this.selectAppodealAccount(accState ? this.appodealAccounts.get(accState.id) : null));
    }

    fetchAppodealUser (accountId: string) {
        return this.appodealApi.getFor(accountId).fetchCurrentUser()
            .then(account => this.addAppodealAccount(account));
    }

    @action
    fetchAllAppodealUsers (): Promise<Map<string, AppodealAccount>> {
        let accountsState = new Map(
            this.state.preferences.accounts.appodealAccounts
                .map<[string, AppodealAccountState]>(account => {
                    return [account.id, account];
                })
        );
        return this.appodealApi.fetchAllAccounts()
            .then(async accounts => {
                let updatedAccounts: Array<AppodealAccountState> = [];
                accounts.forEach((account, accountId) => {
                    if (accountsState.has(accountId)) {
                        let oldState = accountsState.get(accountId);
                        updatedAccounts.push({
                            ...oldState,
                            active: !!account,
                            email: account ? account.email : oldState.email
                        });
                    }
                });
                await this.patchPreferences({
                    accounts: {
                        appodealAccounts: updatedAccounts
                    }
                });
                this.appodealAccounts = accounts;
                if (!this.state.selectedAppodealAccount) {
                    this.selectAppodealAccount(updatedAccounts[0] || null);
                }
                return accounts;
            });
    }

    @action
    selectAdMobAccount (newAccount: AdMobAccount) {
        let {account} = this.state.selectedAccount;
        set<AppState>(this.state, 'selectedAccount', {
            account: newAccount,
            logs: account && newAccount && account.id === newAccount.id ? this.state.selectedAccount.logs : []
        });
        // we dont need to wait while logs are loading
        // we want provide quick response to UI
        // once log-list is loaded - we will show it
        if (newAccount) {
            setTimeout( () => this.pushLogs(newAccount));
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
    async addAdMobAccount (appodealAccountId: string) {
        let account = await AdMobSessions.signIn();
        if (account) {
            let existingAccount = this.state.selectedAppodealAccount.accounts.find(acc => acc.id === account.id);
            if (!existingAccount) {
                let added = await this.appodealApi.getFor(appodealAccountId).addAdMobAccount(account);
                if (added) {
                    await this.fetchAllAppodealUsers();
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
    setAdMobCredentials (
        appodealAccountId: string,
        {accountId, clientId, clientSecret}: { accountId: string, clientId: string, clientSecret: string }
    ) {
        return this.appodealApi.getFor(appodealAccountId).setAdMobAccountCredentials(accountId, clientId, clientSecret)
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
            .then(() => this.fetchAppodealUser(appodealAccountId))
            .then(account => this.selectAppodealAccount(account));
    }

    @action
    async selectAppodealAccount (accountState: UserAccount) {
        if (accountState) {
            let account = this.appodealAccounts.get(accountState.id);
            await this.updateAdmobAccountsInfo(account);
            configureScope(scope => {
                scope.setUser(account);
                scope.setExtra('syncHistory', this.state.syncHistory);
            });
            set<AppState>(this.state, 'selectedAppodealAccount', account);
            this.selectAdMobAccount(null);
            return account;
        }
        return null;
    }

    @action
    async addAppodealAccount (account: AppodealAccount) {
        await this.patchPreferences({
            accounts: {
                appodealAccounts: [
                    ...this.state.preferences.accounts.appodealAccounts.filter(acc => acc.id !== account.id),
                    {
                        id: account.id,
                        email: account.email,
                        active: true
                    }
                ]
            }
        });
        this.appodealAccounts.set(account.id, account);
        return account;
    }


    @action
    async reSignInAdmob (appodealAccountId: string, currentAccount: AdMobAccount) {
        const resultAccount = await reSignIn(currentAccount);
        if (!resultAccount) {
            return;
        }
        if (resultAccount.id === currentAccount.id) {
            return await this.updateAdMobAccountInfo(currentAccount);
        }

        const existedAccount = this.state.selectedAppodealAccount.accounts.find(account => account.id === resultAccount.id);
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

            if (await this.appodealApi.getFor(appodealAccountId).addAdMobAccount(resultAccount)) {
                return await this.fetchAppodealUser(appodealAccountId);
            }
            return this.updateAdMobAccountInfo(currentAccount);
        }

        console.log(`cancel adding new account. delete session`);

    }

    @action
    async patchPreferences (patch: Partial<{ [P in keyof AppPreferences]: Partial<AppPreferences[P]> }>) {
        set<AppState>(this.state, 'preferences', deepAssign({...this.state.preferences}, patch));
        await Preferences.save(this.state.preferences);
    }

}
