import {NetworkError} from './network-error';


export class InternalServerError extends NetworkError {

    constructor (httpError: Error, operationName?: string) {
        super(`[InternalServerError] ${(operationName ? ` [${operationName}] ` : '')} ${httpError.message}`, httpError);
    }

    isCritical () {
        return true;
    }

}
