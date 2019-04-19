import {AppodealApi} from 'core/appdeal-api/appodeal-api.factory';
import {AuthorizationError} from 'core/error-factory/errors/authorization.error';
import {GraphQLError} from 'core/error-factory/errors/grahpql/graphql-error';
import {InternalError} from 'core/error-factory/errors/internal-error';
import EventEmitter from 'events';
import {UserAccount} from 'interfaces/common.interfaces';
import {Sentry} from 'lib/sentry';


const ONE_MINUTE = 60 * 1000;


export class OnlineService extends EventEmitter {

    private _isOnline: boolean;
    private pingTimer;

    constructor (private appodealApi: AppodealApi) {
        super();
        this.init();
    }

    setOffline () {
        this._isOnline = false;
        this.emit('statusChange', this._isOnline);
        this.emit('offline');
    }

    setOnline () {
        this._isOnline = true;
        this.emit('statusChange', this._isOnline);
        this.emit('online');
    }

    init () {
        this.listenApiErrors();
        this.pingWhileOffline();
    }

    pingWhileOffline () {
        clearTimeout(this.pingTimer);
        return this.sendPing()
            .then(() => this.setOnline())
            .catch(() => {
                this.setOffline();
                this.emit('nextReconnect', Date.now() + ONE_MINUTE);
                this.pingTimer = setTimeout(() => this.pingWhileOffline(), ONE_MINUTE);
            });
    }


    private listenApiErrors () {
        this.appodealApi.onError.subscribe(({error}: { error: InternalError, account: UserAccount }) => {
            if (!(error instanceof GraphQLError) && !(error instanceof AuthorizationError)) {
                // can't reach appodeal
                this.setOffline();
            }
            if (error.isCritical && error.isCritical()) {
                Sentry.captureException(error);
            }
        });
    }

    sendPing (): Promise<boolean> {
        return this.appodealApi.getDefault().ping()
            .then((v) => {
                if (v === 'pong') {
                    return true;
                }
                throw new InternalError(`Invalid ping response ${v}`);
            })
            .catch((e: InternalError) => {
                console.error(e);
                throw e;
            });
    }

    isOnline (): boolean {
        return this._isOnline;
    }

    isOffline (): boolean {
        return !this._isOnline;
    }

    async destroy () {
        this.removeAllListeners();
    }


}
