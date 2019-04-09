import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AppodealSessions} from 'core/appdeal-api/appodeal-sessions.helper';
import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {ErrorFactoryService} from 'core/error-factory/error-factory.service';
import {UserAccount} from 'interfaces/common.interfaces';


export class AppodealApi {
    private readonly DEFAULT_API: AppodealApiService;
    private APIs = new Map<string, AppodealApiService>();

    constructor (
        private errorFactory: ErrorFactoryService,
        accounts: Array<UserAccount>
    ) {
        this.DEFAULT_API = new AppodealApiService(errorFactory, AppodealSessions.DEFAULT_SESSION);
        accounts.forEach(account => {
            let api = new AppodealApiService(this.errorFactory, AppodealSessions.get(account));
            api.init(account.id);
            this.APIs.set(account.id, api);
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
            api.init(account.id);
            this.APIs.set(account.id, api);
            sessionInfo.save(account.id);
        }
        return account;
    }

    async signOut (account: UserAccount | string) {
        let accountId = account instanceof Object ? account.id : account,
            api = this.getFor(accountId);
        await api.signOut();
        api.destroy();
        this.APIs.delete(accountId);
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
}
