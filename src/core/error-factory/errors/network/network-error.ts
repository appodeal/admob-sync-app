import {RavenOptions} from 'raven-js';
import {InternalError} from '../internal-error';


export class NetworkError extends InternalError {

    public originalError: Error;

    constructor (message, originalError: Error) {
        super(message, originalError);
    }

    isCritical () {
        return false;
    }

    get options (): RavenOptions {
        const headers = this.originalError['headers']
            ? this.originalError['headers'].entries().reduce((acc, key) => {
                acc[key] = this.originalError['headers'].get(key);
                return acc;
            }, {})
            : {};
        return {
            headers,
            fingerprint: this.fingerPrint(),
            extra: this.extraInfo
        };
    }

}
