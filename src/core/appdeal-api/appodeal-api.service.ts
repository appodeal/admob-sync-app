import {InMemoryCache, NormalizedCacheObject} from 'apollo-cache-inmemory';
import ApolloClient, {MutationOptions, OperationVariables, QueryOptions} from 'apollo-client';
import {ApolloLink, FetchResult, Observable} from 'apollo-link';
import {BatchHttpLink} from 'apollo-link-batch-http';
import {ErrorResponse, onError} from 'apollo-link-error';
import {AdMobSessions} from 'core/admob-api/admob-sessions.helper';
import {AuthContext} from 'core/appdeal-api/AuthContext';
import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {AuthorizationError} from 'core/error-factory/errors/authorization.error';
import {session} from 'electron';
import {openWindow, waitForNavigation} from 'lib/common';
import {createFetcher} from 'lib/fetch';
import {AdMobApp} from 'lib/translators/interfaces/admob-app.interface';
import {ErrorFactoryService} from '../error-factory/error-factory.service';
import {InternalError} from '../error-factory/errors/internal-error';
import addAdMobAccountMutation from './graphql/add-admob-account.mutation.graphql';

import adMobAccountQuery from './graphql/admob-account-details.graphql';
import criticalVersionQuery from './graphql/critical-version.query.graphql';
import currentUserQuery from './graphql/current-user.query.graphql';
import endSync from './graphql/end-sync.mutation.graphql';
import refreshTokenMutation from './graphql/refresh-token-mutation.graphql';
import setAdMobAccountCredentialsMutation from './graphql/set-admob-account-credentials.mutation.graphql';
import signInMutation from './graphql/sign-in.mutation.graphql';
import signOutMutation from './graphql/sign-out.mutation.graphql';
import startSync from './graphql/start-sync.mutation.graphql';
import submitLogMutation from './graphql/submit-log.mutation.graphql';
import syncApp from './graphql/sync-app.mutation.graphql';

import {AdMobAccount, AdMobAccountDetails} from './interfaces/admob-account.interface';
import {AppodealAdUnit, AppodealApp} from './interfaces/appodeal-app.interface';


const pluck = (object, ...props) => {
    let prop;
    let value = object;
    do {
        prop = props.shift();
        value = value[prop];
    } while (props.length && value !== undefined);
    return value;
};

const pluckParams = (dataAttribute) => ['data', dataAttribute].flat(2).filter(v => v);


export interface ApiQueryOptions<V> extends QueryOptions<V> {
    dataAttribute?: string | string[];
}


export interface ApiMutationOptions<T, V> extends MutationOptions<T, V> {
    dataAttribute?: string | string[];
}


export class AppodealApiService {

    static emptyAccount: AppodealAccount = {
        id: null,
        email: null,
        accounts: []
    };

    private client: ApolloClient<NormalizedCacheObject>;
    private session = session.fromPartition('persist:appodeal');
    private fetcher = createFetcher(this.session);

    public onError: (e: InternalError) => void;
    authContext: AuthContext;

    private logRequest (operations, opType, variables) {
        operations.definitions.filter(op => op.kind === 'OperationDefinition').forEach(
            op => console.debug(`[graphql] [${opType}] ${op.name ?
                op.name.value :
                operations.loc.source}(${JSON.stringify(variables || {})})`)
        );
    }

    public query<T, TVariables = OperationVariables> (options: ApiQueryOptions<TVariables>): Promise<T> {
        this.logRequest(options.query, 'query', options.variables);
        return this.client.query<T, TVariables>(<QueryOptions<TVariables>>options)
            .then(result => pluck(result, ...pluckParams(options.dataAttribute)))
            .catch(apolloError => {
                throw <InternalError>apolloError.networkError;
            });
    }

    public mutate<T, TVariables = OperationVariables> (options: ApiMutationOptions<T, TVariables>): Promise<T> {
        this.logRequest(options.mutation, 'mutation', options.variables);
        return this.client.mutate(<MutationOptions<T, TVariables>>options)
            .then(result => pluck(result, ...pluckParams(options.dataAttribute)))
            .catch(apolloError => {
                throw <InternalError>apolloError.networkError;
            });
    };

    constructor (errorFactory: ErrorFactoryService) {
        const errorLink = onError((errorResponse: ErrorResponse) => {
            const error = errorFactory.create(errorResponse);
            this.handleError(error);
            return new Observable<FetchResult>((ob) => ob.error(error));
        });

        const defaultApolloLink = new BatchHttpLink({uri: environment.services.appodeal, fetch: this.fetcher});

        this.authContext = new AuthContext(this);


        this.client = new ApolloClient({
            defaultOptions: {
                query: {
                    fetchPolicy: 'network-only'
                }
            },
            link: ApolloLink.from([
                errorLink,
                this.authContext.createLink(),
                defaultApolloLink
            ]),
            cache: new InMemoryCache()
        });

    }

    private initialized = false;

    async init (): Promise<any> {
        if (this.initialized) {
            return;
        }

        return this.authContext.init().then(() => this.initialized = true);
    }

    handleError (e: InternalError) {
        if (this.onError && e) {
            this.onError(e);
        }
    }

    getCriticalPluginVersion (): Promise<string> {
        return this.query<{ criticalVersion: string }>({
            query: criticalVersionQuery
        }).then(result => result.criticalVersion);
    }

    signIn (email: string, password: string) {
        return this.mutate({
            mutation: signInMutation,
            variables: {
                email,
                password
            },
            dataAttribute: ['signIn']
        }).then(this.authContext.storeSessionFromResponse)
            .catch(e => {
                this.authContext.invalidateAccessToken();
                throw e;
            });
    }

    refreshAccessToken (refreshToken) {
        return this.mutate<any>({
            mutation: refreshTokenMutation,
            variables: {
                refreshToken
            },
            dataAttribute: ['refreshAccessToken']
        }).then(this.authContext.storeSessionFromResponse);
    }

    signOut () {
        return this.mutate({
            mutation: signOutMutation
        }).then(res => {
            this.authContext.invalidateAccessToken();
            return res;
        });
    }

    fetchCurrentUser (): Promise<AppodealAccount> {
        return this.query<{ currentUser: AppodealAccount }>({
            query: currentUserQuery
        })
            .then(result => {
                return result.currentUser || AppodealApiService.emptyAccount;
            })
            .catch(err => {
                if (err instanceof AuthorizationError) {
                    this.authContext.invalidateAccessToken();
                    return AppodealApiService.emptyAccount;
                }
                throw err;
            });
    }

    fetchApps (adMobAccountId: string, page = 1, pageSize = 100): Promise<AdMobAccountDetails> {
        return this.query<any>({
            query: adMobAccountQuery,
            variables: {
                id: adMobAccountId,
                page,
                pageSize
            }
        }).then(result => <AdMobAccountDetails>(result.currentUser.account));
    }

    reportSyncStart (syncId: string, admobAccountId: string) {
        return this.mutate({
            mutation: startSync,
            variables: {
                id: syncId,
                admobAccountId
            }
        });
    }

    reportSyncEnd (syncId: string) {
        return this.mutate({
            mutation: endSync,
            variables: {
                id: syncId
            }
        });
    }

    reportAppSynced (app: AppodealApp, syncId: string, admobAccountId: string, adMobApp: AdMobApp, adUnits: AppodealAdUnit[]) {
        return this.mutate({
            mutation: syncApp,
            variables: {
                id: app.id,
                syncSessionId: syncId,
                admobAppId: adMobApp.appId,
                admobAccountId,
                adUnits: adUnits
            }
        });
    }

    submitLog (admobAccountId: string, syncId: string, rawLog: string) {
        return this.mutate({
            mutation: submitLogMutation,
            variables: {
                admobAccountId,
                syncId,
                rawLog
            }
        });
    }


    setAdMobAccountCredentials (adMobAccountId: string, clientId: string, clientSecret: string): Promise<AppodealAccount> {
        return this.mutate<{ setAdmobAccountCredentials: { oAuthUrl: string } }>({
            mutation: setAdMobAccountCredentialsMutation,
            variables: {
                accountId: adMobAccountId,
                clientId,
                clientSecret
            }
        })
            .then(async ({setAdmobAccountCredentials: {oAuthUrl}}) => {
                let window = await openWindow(oAuthUrl, {
                    frame: true,
                    titleBarStyle: 'default',
                    width: 400,
                    minWidth: 400,
                    webPreferences: {
                        session: AdMobSessions.getSession(adMobAccountId)
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
                return this.fetchCurrentUser();
            });
    }

    addAdMobAccount ({id: accountId, email}: AdMobAccount): Promise<boolean> {
        return this.mutate<{ addAdmobAccount: boolean }>({
            mutation: addAdMobAccountMutation,
            variables: {
                accountId,
                email
            }
        })
            .then(({addAdmobAccount}) => addAdmobAccount);
    }

}
