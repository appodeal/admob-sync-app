import {RavenOptions} from 'raven-js';


export type TransformFn = (key: string) => string;

export class InternalError extends Error {

    /**
     * true if error has been handled on UI
     */
    public isHandled = false;

    /**
     * true if error has been caught by global angular error handler
     */
    public uncaught = false;

    /**
     * true if error has been reported to bug tracker
     */
    public reported = false;
    public originalError;
    public extraInfo;

    // fingerprint can be disabled for some errors
    protected extraFingerPrint: string[] | false = [];
    protected transform = (key: string) => key;

    constructor (message, originalError?) {
        super(message);
        this.originalError = originalError;
        if (originalError && originalError.hasOwnProperty('stack')) {
            this.stack = originalError.stack;
        }
        if (this.constructor.name !== 'InternalError') {
            // insert Error class name into stack
            this.stack = this.constructor.name + this.stack.substr('Error'.length);
        }
    }

    setTransformFn (fn: TransformFn) {
        this.transform = fn;
        return this;
    }

    setExtra ({extra, fingerPrint}: { extra: any, fingerPrint: string[] | false }) {
        this.extraInfo = extra;
        this.extraFingerPrint = fingerPrint;
        return this;
    }

    isCritical () {
        return true;
    }

    get userMessage () {
        return this.transform('errors.InternalError');
    }

    fingerPrint (): string[] {
        return Array.isArray(this.extraFingerPrint)
            ? [this.message, ...this.extraFingerPrint]
            : [];
    }

    get options (): RavenOptions {
        return {
            fingerprint: this.fingerPrint(),
            extra: this.extraInfo
        };
    }

}
