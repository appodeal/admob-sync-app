import {Connector} from 'core/connector';
import {Store} from 'core/store';
import {Action, ActionTypes} from 'lib/actions';


export class OnlineConnector extends Connector {


    constructor (private store: Store) {
        super('online');
    }

    async onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.appodealPing:
            return this.store.pingAppodeal();
        }
    }

    destroy () {
        super.destroy();
    }
}
