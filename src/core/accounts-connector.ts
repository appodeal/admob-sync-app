import {AccountSetup} from 'core/admob-api/account-setup.helper';
import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {Action, ActionTypes} from 'lib/actions';
import {openAppodealAccountsWindow, openAppodealSignInWindow} from 'lib/ui-windows';


export class AccountsConnector extends Connector {
    private setups = new Map<string, AccountSetup>();


    constructor (private store: Store) {
        super('accounts');
    }

    async onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.appodealSignIn:
            return this.store.appodealSignIn(payload.email, payload.password);
        case ActionTypes.adMobReSignIn:
            return this.store.reSignInAdmob(payload.appodealAccountId, payload.adMobAccount);
        case ActionTypes.appodealSignOut:
            return this.store.appodealSignOut(payload.appodealAccountId);
        case ActionTypes.adMobAddAccount:
            let result = await this.store.addAdMobAccount(payload.appodealAccountId);
            let accountForSelection = result.newAccount || result.existingAccount;
            if (accountForSelection) {
                await this.store.selectAdMobAccount(accountForSelection);
            }
            return result;
        case ActionTypes.selectAccount:
            return this.store.selectAdMobAccount(payload.adMobAccount);
        case ActionTypes.adMobSetCredentials:
            return this.store.setAdMobCredentials(payload.appodealAccountId, payload.credentialsInfo)
                .then(() => {
                    this.store.setupState(payload.credentialsInfo.accountId, {visible: false, mode: null});
                });
        case ActionTypes.adMobSetupTutorial:
            return AdMobSessions.openSetupTutorial();
        case ActionTypes.adMobSetupAccount:
            this.store.removeAccountSetup(payload.adMobAccount.id);
            return this.setupAccount(payload.appodealAccountId, payload.adMobAccount);
        case ActionTypes.adMobSetupState:
            this.store.removeAccountSetup(payload.adMobAccount.id);
            return this.store.setupState(payload.adMobAccount.id, payload.state);
        case ActionTypes.adMobCancelSetup:
            let setup = this.setups.get(payload.adMobAccount.id);
            if (setup) {
                await setup.stop();
                this.setups.delete(payload.adMobAccount.id);
                this.store.removeAccountSetup(payload.adMobAccount.id);
            }
            return this.store.setupState(payload.adMobAccount.id, {visible: false, mode: null});
        case ActionTypes.adMobShowSetup:
            let currentSetup = this.setups.get(payload.adMobAccount.id);
            if (currentSetup && currentSetup.window) {
                if (currentSetup.window.isVisible()) {
                    currentSetup.window.hide();
                } else {
                    currentSetup.window.show();
                }
            }
            break;
        case ActionTypes.openAdmobPage:
            return AdMobSessions.openAdmob(payload.adMobAccount);
        case ActionTypes.manageAppodealAccounts:
            return openAppodealAccountsWindow();
        case ActionTypes.addAppodealAccount:
            return openAppodealSignInWindow(payload.appodealAccount);
        case ActionTypes.selectAppodealAccount:
            return this.store.selectAppodealAccount(payload.account);
        default:
            return;
        }
    }

    private setupAccount (appodealAccountId: string, adMobAccount: AdMobAccount) {
        let setup = new AccountSetup(adMobAccount);
        this.setups.set(adMobAccount.id, setup);
        setup
            .on('progress', progress => this.store.setAccountSetupProgress(adMobAccount.id, progress.percent))
            .once('start', () => this.store.startAccountSetup(adMobAccount.id))
            .once('finish', ({clientId, clientSecret}) => {
                this.setups.delete(adMobAccount.id);
                this.store.setAdMobCredentials(appodealAccountId, {
                    clientId,
                    clientSecret,
                    accountId: adMobAccount.id
                }).finally(() => {
                    this.store.removeAccountSetup(adMobAccount.id);
                    this.store.setupState(adMobAccount.id, {visible: false, mode: null});
                });
            })
            .once('cancel', () => {
                this.setups.delete(adMobAccount.id);
                this.store.removeAccountSetup(adMobAccount.id);
            })
            .once('error', () => {
                this.store.errorAccountSetup(adMobAccount.id);
            })
            .start();
    }

    async destroy (): Promise<void> {
        for (let setup of this.setups.values()) {
            await setup.stop();
        }
        await super.destroy();
    }
}
