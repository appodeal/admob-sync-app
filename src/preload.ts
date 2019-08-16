import {cutElectronFromUserAgent} from './lib/user-agent';


function overrideGetter (target: any, key: string, getter: () => any) {
    if (Object.defineProperty) {
        Object.defineProperty(target, key, {
            get: getter
        });
    } else {
        // @ts-ignore
        if (Object.prototype.__defineGetter__) {
            // @ts-ignore
            navigator.__proto__.__defineGetter__('target', getter);
        }
    }
}

const defaultUserAgent = navigator.userAgent;
const defaultAppVersion = navigator.appVersion;

overrideGetter(navigator, 'userAgent', () => cutElectronFromUserAgent(defaultUserAgent));
overrideGetter(navigator, 'appVersion', () => cutElectronFromUserAgent(defaultAppVersion));
