import {Subscription} from 'apollo-client/util/Observable';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AppodealSessions} from 'core/appdeal-api/appodeal-sessions.helper';
import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {AuthorizationError} from 'core/error-factory/errors/authorization.error';
import {InternalError} from 'core/error-factory/errors/internal-error';
import {UserAccount} from 'interfaces/common.interfaces';
import PushStream from 'zen-push';


export class AppodealApi {
    private readonly DEFAULT_API: AppodealApiService;
    private APIs = new Map<string, AppodealApiService>();
    private errorSubscriptions = new Map<string, Subscription>();
    private _onError = new PushStream<{account: UserAccount, error: Error}>();
    onError = this._onError.observable;

    constructor (
        private errorFactory: ErrorFactoryService,
        accounts: Array<UserAccount>
    ) {
        this.DEFAULT_API = new AppodealApiService(errorFactory, AppodealSessions.DEFAULT_SESSION);
        accounts.forEach(account => {
            let api = new AppodealApiService(this.errorFactory, AppodealSessions.get(account));
            this.saveApi(api, account);
        });
    }

    getDefault (): AppodealApiService {
        return this.DEFAULT_API;
    }

    getFor (account: UserAccount | string): AppodealApiService {
        let accountId = account instanceof Object ? account.id : account;
        if (this.APIs.has(accountId)) {
            return this.APIs.get(accountId);
        }
    }

    async signIn (email: string, password: string): Promise<AppodealAccount> {
        let sessionInfo = AppodealSessions.create(),
            api = new AppodealApiService(this.errorFactory, sessionInfo.session);
        let account = await api.signIn(email, password)
            .catch(async err => {
                await sessionInfo.remove();
                throw err;
            });
        if (account) {
            this.destroyApi(account.id);
            this.saveApi(api, account);
            sessionInfo.save(account.id);
        } else {
            api.destroy();
        }
        return account;
    }

    async signOut (account: UserAccount | string) {
        let accountId = account instanceof Object ? account.id : account,
            api = this.getFor(accountId);
        await api.signOut().catch((error: InternalError) => {
            if (!(error instanceof AuthorizationError)) {
                throw error;
            } else {
                error.isHandled = true;
            }
        });
        this.destroyApi(accountId);
        await AppodealSessions.remove(accountId);
    }

    async fetchAllAccounts (): Promise<Map<string, AppodealAccount>> {
        return new Map(await Promise.all<[string, AppodealAccount]>(
            [...this.APIs.entries()]
                .map(([accountId, api]) => {
                    return api.fetchCurrentUser()
                        .catch(() => null)
                        .then<[string, AppodealAccount]>(account => [accountId, account]);
                })
        ));
    }

    private destroyApi (accountId: string) {
        if (this.APIs.has(accountId)) {
            this.APIs.get(accountId).destroy();
            this.APIs.delete(accountId);
        }
        if (this.errorSubscriptions.has(accountId)) {
            this.errorSubscriptions.get(accountId).unsubscribe();
            this.errorSubscriptions.delete(accountId);
        }
    }

    private saveApi (api: AppodealApiService, account: UserAccount) {
        api.init(account.id);
        this.APIs.set(account.id, api);
        this.errorSubscriptions.set(account.id, api.onError.subscribe(error => {
            setTimeout(() => this._onError.next({
                account,
                error
            }));
        }));
    }
}
