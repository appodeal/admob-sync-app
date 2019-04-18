import {Connector} from 'core/connector';
import {Action, ActionTypes} from 'lib/actions';
import packageInfo from './../../package.json';
import {shell} from 'electron';

export class AboutConnector extends Connector {

    constructor() {
        super('about');
    }

    async onAction({type, payload}: Action) {
        switch(type) {
            case ActionTypes.packageInfo:
                return packageInfo;
            case ActionTypes.openPrivacyPolicy:
                shell.openExternal('https://www.appodeal.com/home/privacy-policy')
        }
        return;
    }
}
