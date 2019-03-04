import {NetworkError} from './network-error';


export class UnavailableEndpointError extends NetworkError {

    constructor (httpError: Error) {
        super(`[UnAvailableEndpointError] ${httpError.message}`, httpError);
    }

    isCritical () {
        return true;
    }

}
