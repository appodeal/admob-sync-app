import {GraphQLError} from './graphql-error';


export class GraphQLSchemaError extends GraphQLError {

    constructor (message, originalError) {
        super([message, GraphQLError.extractErrorText(originalError)].join('\n'), originalError);
    }

    isCritical () {
        return true;
    }

}
