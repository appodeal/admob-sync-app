import {InMemoryCache, NormalizedCacheObject} from 'apollo-cache-inmemory';
import ApolloClient, {MutationOptions, OperationVariables, QueryOptions} from 'apollo-client';
import {ApolloLink, FetchResult, Observable} from 'apollo-link';
import {BatchHttpLink} from 'apollo-link-batch-http';
import {ErrorResponse, onError} from 'apollo-link-error';
import {AuthContext, TokensInfo} from 'core/appdeal-api/auth-context';
import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {AuthorizationError} from 'core/error-factory/errors/authorization.error';
import {ExtractedAdmobAccount} from 'interfaces/common.interfaces';
import {Fetcher} from 'lib/fetch';
import {AdMobApp} from 'lib/translators/interfaces/admob-app.interface';
import PushStream from 'zen-push';
import {ErrorFactoryService} from '../error-factory/error-factory.service';
import {InternalError} from '../error-factory/errors/internal-error';
import {NetworkError} from '../error-factory/errors/network/network-error';
import {CallQueue} from './call-queue';
import addAdMobAccountMutation from './graphql/add-admob-account.mutation.graphql';
import adMobAccountQuery from './graphql/admob-account-details.graphql';
import currentUserQuery from './graphql/current-user.query.graphql';
import endSync from './graphql/end-sync.mutation.graphql';
import minimalAppVersionQuery from './graphql/minimal-app-version.query.graphql';

import pingQuery from './graphql/ping.query.graphql';
import refreshTokenMutation from './graphql/refresh-token-mutation.graphql';
import setAdMobAccountCredentialsMutation from './graphql/set-admob-account-credentials.mutation.graphql';
import setAdmobAccountIdMutation from './graphql/set-admob-account-id.mutation.graphql';
import signInMutation from './graphql/sign-in.mutation.graphql';
import signOutMutation from './graphql/sign-out.mutation.graphql';
import startSync from './graphql/start-sync.mutation.graphql';
import submitLogMutation from './graphql/submit-log.mutation.graphql';
import syncApp from './graphql/sync-app.mutation.graphql';

import {AdMobAccountDetails} from './interfaces/admob-account.interface';
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

    private requestsQueue = new CallQueue(10);
    private client: ApolloClient<NormalizedCacheObject>;
    private _onError = new PushStream<InternalError>();

    public onError = this._onError.observable;

    authContext: AuthContext;

    constructor (errorFactory: ErrorFactoryService, private fetcher: Fetcher) {
        const errorLink = onError((errorResponse: ErrorResponse) => {
            const error = errorFactory.create(errorResponse);
            console.log(JSON.stringify(errorResponse));
            this.handleError(error);
            return new Observable<FetchResult>((ob) => ob.error(error));
        });

        const defaultApolloLink = new BatchHttpLink({uri: environment.services.appodeal, fetch: this.fetcher});

        this.authContext = new AuthContext();


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

    private logRequest (operations, opType, variables) {
        operations.definitions.filter(op => op.kind === 'OperationDefinition').forEach(
            op => console.debug(`[graphql] [${opType}] ${op.name ?
                op.name.value :
                operations.loc.source}(${JSON.stringify(variables || {})})`)
        );
    }

    public query<T, TVariables = OperationVariables> (options: ApiQueryOptions<TVariables>, dedicated = false): Promise<T> {
        return this.requestsQueue.call(() => {
            this.logRequest(options.query, 'query', options.variables);
            return this.client.query<T, TVariables>(<QueryOptions<TVariables>>options)
                .then(result => pluck(result, ...pluckParams(options.dataAttribute)))
                .catch(apolloError => {
                    throw <InternalError>apolloError.networkError;
                });
        }, dedicated);
    }

    public mutate<T, TVariables = OperationVariables> (options: ApiMutationOptions<T, TVariables>, dedicated = false): Promise<T> {
        return this.requestsQueue.call(() => {
            this.logRequest(options.mutation, 'mutation', options.variables);
            return this.client.mutate(<MutationOptions<T, TVariables>>options)
                .then(result => pluck(result, ...pluckParams(options.dataAttribute)))
                .catch(apolloError => {
                    throw <InternalError>apolloError.networkError;
                });
        }, dedicated);
    };

    private initialized = false;

    init (accountId: string) {
        if (this.initialized) {
            return;
        }
        this.authContext.init(accountId);
        this.authContext.on('refresh', refreshToken => {
            this.refreshAccessToken(refreshToken).catch((e: InternalError) => {
                console.warn(e);
                if (!(e instanceof NetworkError)) {
                    throw e;
                }
            });
        });
        this.initialized = true;
    }

    destroy () {
        this.authContext.destroy();
    }

    handleError (e: InternalError) {
        this._onError.next(e);
    }

    getMinimalAppVersion (): Promise<string> {
        return this.query<{ minimalAppVersion: string }>({
            query: minimalAppVersionQuery
        }).then(result => result.minimalAppVersion);
    }

    signIn (email: string, password: string): Promise<AppodealAccount> {
        return this.mutate<{ accessToken: string, refreshToken: string }>({
            mutation: signInMutation,
            variables: {
                email,
                password
            },
            dataAttribute: ['signIn']
        })
            .then(tokensInfo => {
                this.authContext.setTokensInfo(tokensInfo);
                return this.fetchCurrentUser();
            })
            .then(account => {
                this.authContext.setAccountId(account.id);
                this.authContext.save();
                return account;
            })
            .catch(e => {
                this.authContext.remove();
                throw e;
            });
    }

    refreshAccessToken (refreshToken) {
        return this.mutate<TokensInfo>({
            mutation: refreshTokenMutation,
            variables: {
                refreshToken
            },
            dataAttribute: ['refreshAccessToken']
        }, true)
            .then(tokensInfo => {
                this.authContext.setTokensInfo(tokensInfo);
                this.authContext.save();
                return tokensInfo;
            });
    }

    signOut () {
        return this.mutate({
            mutation: signOutMutation
        }).finally(async () => {
            await this.authContext.remove();
            this.authContext.removeAllListeners();
        });
    }

    fetchCurrentUser (): Promise<AppodealAccount> {
        return this.query<{ currentUser: AppodealAccount }>({
            query: currentUserQuery
        })
            .then(result => {
                return result.currentUser;
            })
            .catch(err => {
                if (err instanceof AuthorizationError) {
                    this.authContext.remove();
                    return null;
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


    setAdMobAccountCredentials (adMobAccountId: string, clientId: string, clientSecret: string): Promise<string> {
        return this.mutate<{ setAdmobAccountCredentials: { oAuthUrl: string } }>({
            mutation: setAdMobAccountCredentialsMutation,
            variables: {
                accountId: adMobAccountId,
                clientId,
                clientSecret
            }
        })
            .then(async ({setAdmobAccountCredentials: {oAuthUrl}}) => oAuthUrl);
    }

    setAdmobAccountId (email: string, adMobAccountId: string): Promise<boolean> {
        return this.mutate({
            mutation: setAdmobAccountIdMutation,
            variables: {
                email: email,
                accountId: adMobAccountId
            },
            dataAttribute: 'setAdmobAccountId'
        });
    }


    addAdMobAccount ({id: accountId, email}: ExtractedAdmobAccount): Promise<boolean> {
        return this.mutate<{ addAdmobAccount: boolean }>({
            mutation: addAdMobAccountMutation,
            variables: {
                accountId,
                email
            }
        })
            .then(({addAdmobAccount}) => addAdmobAccount);
    }

    ping () {
        return this.query<'pong'>({
            query: pingQuery,
            dataAttribute: 'ping'
        });
    }

}
