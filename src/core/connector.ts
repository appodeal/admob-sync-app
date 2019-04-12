import {Action} from 'lib/actions';
import {onActionFromRenderer} from 'lib/messages';


const CHANNELS = new Map<string, Connector>();
const SUBSCRIPTIONS = new WeakMap<Connector, {unsubscribe: Function}>();

export abstract class Connector {

    protected constructor (private channelName: string) {
        if (CHANNELS.has(channelName)) {
            throw new Error(`Channel "${channelName}" is already used by ${CHANNELS.get(channelName).constructor.name}`);
        } else {
            CHANNELS.set(channelName, this);
        }
        this.init();
    }

    init () {
        let unsubscribe = onActionFromRenderer(this.channelName, action => this.onAction(action));
        SUBSCRIPTIONS.set(this, {unsubscribe});
    }

    destroy () {
        SUBSCRIPTIONS.get(this).unsubscribe();
        CHANNELS.delete(this.channelName);
    }

    abstract onAction (action: Action): Promise<any>
}
