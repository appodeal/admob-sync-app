import {NetworkError} from './network-error';


export class NoConnectionError extends NetworkError {

    constructor (httpError: Error) {
        super(`[NoConnectionError] ${httpError.message}`, httpError);
    }

    isCritical () {
        return false;
    }

    get userMessage () {
        return this.transform('errors.NoConnectionError');
    }

}
