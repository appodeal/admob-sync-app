import {SyncEvent, SyncEventsTypes} from 'core/sync-apps/sync.events';
import * as Observable from 'zen-observable';

import PushStream from 'zen-push';


export class SyncEventEmitter {

    private events = new PushStream<SyncEvent>();

    emit (event: SyncEvent) {
        this.events.next(event);
    }

    on (eventsType?: SyncEventsTypes): Observable<SyncEvent> {
        if (eventsType) {
            return this.events.observable.filter(event => event.type === eventsType);
        }
        return this.events.observable;
    }

}
