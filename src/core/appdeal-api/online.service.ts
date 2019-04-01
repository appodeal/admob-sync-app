import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {GraphQLError} from 'core/error-factory/errors/grahpql/graphql-error';
import {InternalError} from 'core/error-factory/errors/internal-error';
import {Sentry} from 'lib/sentry';
import Observable from 'zen-observable';


class OnlineObservable<T> {

    observers = [];
    private completed = false;
    public observable: Observable<T>;

    constructor (private _value: T) {
        this.observable = new Observable(observer => {
            this.observers.push(observer);
            observer.next(_value);
            return () => { this.observers = this.observers.filter(v => v !== observer);};
        });
    }

    next (value: T) {
        if (this.completed) {
            return;
        }
        if (this._value === value) {
            return;
        }
        this._value = value;
        this.observers.slice(0).forEach(observer => observer.next(this._value));
    }

    get value () {
        return this._value;
    }

    complele () {
        this.completed = true;
        this.observers = [];
    }
}


export class OnlineService {

    private isOnline$ = new OnlineObservable(false);

    constructor (private appodealApi: AppodealApiService) {
        this.init();
    }

    setOffline () {
        this.isOnline$.next(false);
    }

    setOnline () {
        this.isOnline$.next(true);
    }

    init () {
        this.listenApiErrors();
        this.sendPing(true);
    }

    private listenApiErrors () {
        this.appodealApi.onError.subscribe((e: InternalError) => {
            if (!(e instanceof GraphQLError)) {
                // can't reach appodeal
                this.setOffline();
            }
            if (e.isCritical && e.isCritical()) {
                Sentry.captureException(e);
            }
        });
    }

    /**
     * throw error if silent = false
     * @param silent
     */
    sendPing (silent = true): Promise<boolean> {
        return this.appodealApi.ping()
            .then((v) => {
                if (v === 'pong') {
                    this.setOnline();
                    return true;
                }
                throw new InternalError(`Invalid ping response ${v}`);
            })
            .catch((e: InternalError) => {
                console.error(e);
                this.setOffline();
                if (!silent) {
                    throw e;
                }
                return false;
            });
    }

    onceOnline (): Promise<void> {
        return new Promise((resolve => {
            const sub = this.isOnline$.observable.subscribe(() => {
                // to make it asynchronously as value can be emitted instantly & sub variable still have no subscription
                setTimeout(() => {
                    sub.unsubscribe();
                    resolve();
                });
            });
        }));
    }

    online (): Observable<boolean> {
        return this.isOnline$.observable;
    }

    whenOffline () {
        return this.isOnline$.observable.filter(v => !v);
    }

    whenOnline () {
        return this.isOnline$.observable.filter(Boolean);
    }


    isOnline (): boolean {
        return this.isOnline$.value;
    }

    isOffline (): boolean {
        return !this.isOnline$.value;
    }

    destroy () {
        this.isOnline$.complele();
    }


}
