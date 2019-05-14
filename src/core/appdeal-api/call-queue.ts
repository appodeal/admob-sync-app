import {sleep} from '../../lib/time';


export class CallQueue {

    private tail: Promise<any> = Promise.resolve();

    private requests = new Map<Function, Promise<any>>();

    private dedicatedRequestOnFlight = false;

    constructor (private sleepAfterDedicatedRequest: number) {}


    call<T> (request: () => Promise<T>, dedicated = false) {
        if (dedicated) {
            return this.dedicatedCall(request);
        }

        if (this.dedicatedRequestOnFlight) {
            return this.tail.then(() => this.call(request));
        }

        const response = request();
        this.requests.set(request, response);
        return response
            .then(resp => {
                this.requests.delete(request);
                return resp;
            }, error => {
                this.requests.delete(request);
                throw error;
            });

    }

    dedicatedCall<T> (request: () => Promise<T>) {
        if (this.dedicatedRequestOnFlight) {
            return this.tail.then(() => this.dedicatedCall(request));
        }

        this.dedicatedRequestOnFlight = true;

        const response = this.tail.then(() => Promise.all([...this.requests.entries()]))
            .then(() => {
                const resp = request();
                this.requests.set(request, resp);
                return resp.then((r) => {
                    this.dedicatedRequestOnFlight = false;
                    this.requests.delete(request);
                    return r;
                }, (e) => {
                    this.dedicatedRequestOnFlight = false;
                    this.requests.delete(request);
                    throw e;
                });
            });
        this.tail = response.then((resp) => sleep(this.sleepAfterDedicatedRequest).then(() => resp));
        return response;
    }

}
