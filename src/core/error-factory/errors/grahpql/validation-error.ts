import {ErrorResponse} from 'apollo-link-error';

import {GraphQLError as ApolloGraphQLError} from 'graphql';
import {GraphQLError} from './graphql-error';


const isObject = value => value !== null && typeof value === 'object';

export const isValidationGraphQLError = x => x.path;

export class GraphQLValidationError extends GraphQLError {

    public messages = [];
    public fields = {};

    static extractFields (originalError: ErrorResponse) {
        return originalError.graphQLErrors
            .filter(isValidationGraphQLError)
            .reduce((acc, error: ApolloGraphQLError) => {
                if (error.extensions && error.extensions.errors && isObject(error.extensions.errors)) {
                    acc = {...acc, ...error.extensions.errors};
                }
                return acc;
            }, {});
    }

    static fieldsToString (fields: any): string {
        return Object.keys(fields).map(key => `${key}: ${fields[key]}`).join('\n');
    }

    constructor (message, originalError: ErrorResponse) {
        super(
            [
                message,
                GraphQLError.extractErrorText(originalError),
                GraphQLValidationError.fieldsToString(GraphQLValidationError.extractFields(originalError))
            ].filter(x => x).join('\n'),
            originalError
        );

        this.fields = GraphQLValidationError.extractFields(originalError);
        this.messages = originalError.graphQLErrors
            .filter(isValidationGraphQLError)
            .map((error: ApolloGraphQLError) => error.message);
    }

    isCritical () {
        return this.messages.length === 0 && Object.keys(this.fields).length === 0;
    }

    get userMessage () {
        return this.messages.join('\n');
    }
}
