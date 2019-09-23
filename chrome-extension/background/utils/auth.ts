import {InMemoryCache} from 'apollo-cache-inmemory';
import ApolloClient from 'apollo-client';
import {ApolloLink, FetchResult, Observable} from 'apollo-link';
import {BatchHttpLink} from 'apollo-link-batch-http';
import {ErrorResponse, onError} from 'apollo-link-error';
import gql from 'graphql-tag';


export async function auth (app) {

    const errorLink = onError((errorResponse: ErrorResponse) => {
        const error = app.errorFactory.create(errorResponse);
        console.log(JSON.stringify(errorResponse));
        return new Observable<FetchResult>((ob) => ob.error(error));
    });

    const client = new ApolloClient({
        defaultOptions: {
            query: {
                fetchPolicy: 'network-only'
            }
        },
        link: ApolloLink.from([
            errorLink,
            new BatchHttpLink({uri: environment.services.appodeal_auth, fetch: this.fetcher})
        ]),
        cache: new InMemoryCache()
    });

    const {data} = await client.mutate({
        mutation: gql`mutation authenticateAdmobSync{
            authenticateAdmobSync {
                accessToken
                refreshToken
            }}`
    });

    console.debug('[authenticateAdmobSync]', data);

    return data.authenticateAdmobSync;
}
