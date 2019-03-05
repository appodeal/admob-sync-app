import {Store} from 'core/store';
import {Action, ActionTypes} from 'lib/actions';
import {onActionFromRenderer} from 'lib/common';


export class SyncConnector {
    constructor (private store: Store) {
        this.init();
    }

    init () {
        this.onAction = this.onAction.bind(this);
        onActionFromRenderer('accounts', action => this.onAction(action));
    }

    onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.runSync:
            console.log(type, payload);
            // to RunSync
            return;
        }
    }

    runSync () {

    }


    destory () {
        // stopAllSync
    }
}
