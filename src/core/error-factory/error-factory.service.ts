import {ErrorResponse} from 'apollo-link-error';
import {GraphQLError} from 'graphql';
import {AuthorizationError} from './errors/authorization.error';
import {isAuthorizationGraphQLError, isCriticalGraphQLError} from './errors/grahpql/graphql-error';
import {GraphQLSchemaError} from './errors/grahpql/graphql-schema-error';
import {GraphQLValidationError} from './errors/grahpql/validation-error';
import {InternalError} from './errors/internal-error';
import {InternalServerError} from './errors/network/internal-server-error';
import {NetworkError} from './errors/network/network-error';
import {NoConnectionError} from './errors/network/no-connection-error';
import {UnavailableEndpointError} from './errors/network/unavailable-endpoint-error';


enum HttpStatus {
    InternalServerError = 500,
    Unauthorized = 401
}


export declare type ServerError = Error & {
    response: Response;
    result: Record<string, any>;
    statusCode: number;
};

const isNetworkError = (err) => err && err.statusCode !== undefined || err.message === 'net::ERR_INTERNET_DISCONNECTED';
const isApolloResponseError = (err) => err
    && err.hasOwnProperty('operation')
    && (err.hasOwnProperty('graphQLErrors') || err.hasOwnProperty('networkError'));
const criticalGraphQLErrors = (graphQLErrors: ReadonlyArray<GraphQLError>) => graphQLErrors.some(isCriticalGraphQLError);
const authorizationGraphQLErrors = (graphQLErrors: ReadonlyArray<GraphQLError>) => graphQLErrors.some(isAuthorizationGraphQLError);

export class ErrorFactoryService {


    private transform = (key: string, options?: any): string => {
        // try {
        //     return this.i18next.transform(key, options);
        // } catch (e) {
        //     console.error('transformError', e);
        return key;
        // }
    };

    constructor () {}

    /**
     * wrap any error to InternalError. Any service or component should know how to handle InternalError.
     * @param  {ErrorResponse | Error} apolloResponseOrError
     * @return {InternalError}
     */
    create (apolloResponseOrError: ErrorResponse | Error | InternalError): InternalError {
        if (apolloResponseOrError instanceof InternalError) {
            return apolloResponseOrError;
        }
        try {
            return this.createError(apolloResponseOrError)
                .setTransformFn(this.transform)
                .setExtra(this.extractGraphQLContext(apolloResponseOrError));
        } catch (e) {
            console.error(e);
            return new InternalError(
                '[ErrorFabricService] failed to create error for',
                {apolloResponseOrError, internalError: e}
            )
                .setTransformFn(this.transform)
                .setExtra({
                    extra: {apolloResponseOrError, internalError: e},
                    fingerPrint: false
                });
        }
    }

    private createError (apolloResponseOrError: ErrorResponse | Error): InternalError {
        if (isApolloResponseError(apolloResponseOrError)) {
            return this.processApolloResponseError(<ErrorResponse>apolloResponseOrError);
        }
        return this.processInternalError(<Error>apolloResponseOrError);
    }

    processApolloResponseError (response: ErrorResponse) {

        if (response.graphQLErrors && response.graphQLErrors.length) {
            // schema or validation
            return this.createGraphQLError(response);
        }


        // no connection
        // unavailable endpoint
        // 500
        // internal error apollo put there local errors too
        return (isNetworkError(response.networkError)
                ? this.createNetworkError(<ServerError>response.networkError, response.operation.operationName)
                : this.createInternalError(response.networkError)
        );

    }


    processInternalError (error: Error) {
        return isNetworkError(error)
            ? this.createNetworkError(<ServerError>error)
            : this.createInternalError(error);
    }

    extractGraphQLContext (originalError: any) {
        if (!isApolloResponseError(originalError)) {
            return {extra: undefined, fingerPrint: []};
        }
        const error = <ErrorResponse>originalError;
        const extra = <any>{};
        const fingerPrint = [];
        extra.graphQLRequest = {
            name: error.operation.query.loc.source.name,
            operationName: error.operation.operationName,
            query: error.operation.query.loc.source.body,
            variables: error.operation.variables,
            extensions: error.operation.extensions
        };
        fingerPrint.push(extra.graphQLRequest.operationName);
        if (error.graphQLErrors) {
            extra.graphQLErrors = error.graphQLErrors;
            error.graphQLErrors
                .filter(isCriticalGraphQLError)
                .forEach(e => fingerPrint.push(JSON.stringify(e)));
        }
        if (error.networkError) {
            extra.networkError = error.networkError;
        }

        return {extra, fingerPrint};
    }


    /**
     * @param {ServerError} httpError
     * @param {string} [operationName]
     * @return {NoConnectionError|InternalServerError|UnavailableEndpointError|AuthorizationError}
     */
    createNetworkError (httpError: ServerError, operationName?: string) {
        if (httpError.statusCode === 0 || httpError.message === 'net::ERR_INTERNET_DISCONNECTED') {
            return new NoConnectionError(httpError);
        }

        if (httpError.statusCode === HttpStatus.InternalServerError) {
            return new InternalServerError(httpError, operationName);
        }

        if (httpError.statusCode === HttpStatus.Unauthorized) {
            return new AuthorizationError(httpError, operationName);
        }

        // has any status
        if (httpError.statusCode > 0) {
            return new UnavailableEndpointError(httpError);
        }

        return new NetworkError('[NetworkError]', httpError);
    }

    /**
     * @param originalError
     * @return {InternalError}
     */
    createInternalError (originalError) {
        return new InternalError(originalError.message, originalError);
    }

    /**
     * schema or validation
     * @param response
     * @return GraphQLSchemaError|GraphQLValidationError|AuthorizationError
     */
    createGraphQLError (response: ErrorResponse) {

        const message = `${response.operation.operationName || response.operation.query.loc.source.body}`;

        if (authorizationGraphQLErrors(response.graphQLErrors)) {
            return new AuthorizationError(response, message);
        }

        if (criticalGraphQLErrors(response.graphQLErrors)) {
            return new GraphQLSchemaError(message, response);
        }

        return new GraphQLValidationError(message, response);
    }


}
