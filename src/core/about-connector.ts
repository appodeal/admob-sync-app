import {Connector} from 'core/connector';
import {shell} from 'electron';
import {Action, ActionTypes} from 'lib/actions';
import packageInfo from './../../package.json';


export class AboutConnector extends Connector {

    constructor () {
        super('about');
    }

    async onAction ({type, payload}: Action) {
        switch (type) {
        case ActionTypes.packageInfo:
            return packageInfo;
        case ActionTypes.openExternalUrl:
            shell.openExternal(payload);
            return;
        }

        return;
    }
}
