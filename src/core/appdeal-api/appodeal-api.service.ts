import {InMemoryCache, NormalizedCacheObject} from 'apollo-cache-inmemory';
import ApolloClient, {MutationOptions, OperationVariables, QueryOptions} from 'apollo-client';
import {ApolloLink, FetchResult, Observable} from 'apollo-link';
import {BatchHttpLink} from 'apollo-link-batch-http';
import {ErrorResponse, onError} from 'apollo-link-error';
import {AuthorizationError} from 'core/error-factory/errors/authorization.error';
import {session} from 'electron';
import gql from 'graphql-tag';
import {AppodealAccount} from 'interfaces/appodeal.interfaces';
import {createFetcher} from 'lib/fetch';
import {AdMobApp} from 'lib/translators/interfaces/admob-app.interface';
import {ErrorFactoryService} from '../error-factory/error-factory.service';
import {InternalError} from '../error-factory/errors/internal-error';
import adMobAccountQuery from './graphql/admob-account-details.graphql';
import criticalVersionQuery from './graphql/critical-version.query.graphql';
import currentUserQuery from './graphql/current-user.query.graphql';
import endSync from './graphql/endSync.graphql';
import signInMutation from './graphql/sign-in.mutation.graphql';
import signOutMutation from './graphql/sign-out.mutation.graphql';
import startSync from './graphql/startSync.graphql';
import syncApp from './graphql/syncApp.graphql';
import {AdMobAccountDetails} from './interfaces/admob-account.interface';
import {AppodealAdUnit, AppodealApp} from './interfaces/appodeal-app.interface';


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


    public query<T, TVariables = OperationVariables> (options: QueryOptions<TVariables>): Promise<T> {
        return this.client.query<T, TVariables>(options).then(result => result.data);
    }

    public mutate<T, TVariables = OperationVariables> (options: MutationOptions<T, TVariables>): Promise<T> {
        return this.client.mutate(options).then(result => result.data);

    };

    constructor (errorFactory: ErrorFactoryService) {
        const errorLink = onError((errorResponse: ErrorResponse) => {
            const error = errorFactory.create(errorResponse);
            this.handleError(error);
            return new Observable<FetchResult>((ob) => ob.error(error));
        });

        const defaultApolloLink = new BatchHttpLink({uri: environment.services.appodeal, fetch: this.fetcher});
        this.client = new ApolloClient({
            defaultOptions: {
                query: {
                    fetchPolicy: 'network-only'
                }
            },
            link: ApolloLink.from([
                errorLink,
                defaultApolloLink
            ]),
            cache: new InMemoryCache()
        });

    }

    handleError (e: InternalError) {
        if (this.onError && e) {
            this.onError(e);
        }
    }

    // for test purpose
    error401 (): Promise<string> {
        return this.query<{ criticalVersion: string }>({
            query: gql`query {error401}`
        }).then(result => result.criticalVersion);
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
            }
        });
    }

    signOut () {
        return this.mutate({
            mutation: signOutMutation
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

    reportSyncStart (syncId: string) {
        return this.mutate({
            mutation: startSync,
            variables: {
                id: syncId
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

    reportAppSynced (app: AppodealApp, syncId: string, adMobApp: AdMobApp, adUnits: AppodealAdUnit[]) {
        return this.mutate({
            mutation: syncApp,
            variables: {
                id: app.id,
                syncSessionID: syncId,
                admobAppId: adMobApp.appId,
                adUnits: adUnits
            }
        });
    }

}
