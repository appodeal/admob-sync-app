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
        case ActionTypes.openElectronLicence:
            shell.openExternal('https://github.com/electron/electron/blob/master/LICENSE');
            return;
        case ActionTypes.openPrivacyPolicy:
            shell.openExternal('https://www.appodeal.com/home/privacy-policy');
            return;
        }
        return;
    }
}
