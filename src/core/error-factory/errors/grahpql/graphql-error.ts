import {ErrorResponse} from 'apollo-link-error';
import {InternalError} from '../internal-error';


enum GraphQLErrorType {
    Unauthorized = 'unauthorized'
}

export const isCriticalGraphQLError = x => !x.path;
export const isAuthorizationGraphQLError = error => error.extensions && error.extensions.errorType === GraphQLErrorType.Unauthorized;

export class GraphQLError extends InternalError {

    public originalError: ErrorResponse;

    static extractErrorText (originalError: ErrorResponse) {
        return originalError.graphQLErrors.map(error => error.path
            ? `${JSON.stringify(error.path)} ${error.message}`
            : `${JSON.stringify(error)}`
        )
            .join('\n');
    }

    constructor (message, originalError) {
        super(message, originalError);
    }

    fingerPrint () {
        return [
            this.originalError.operation.query.loc.source.body,
            ...this.originalError.graphQLErrors.map(error => JSON.stringify(error))
        ];
    }
}

