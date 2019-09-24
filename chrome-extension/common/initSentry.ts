import * as Sentry from '@sentry/browser';
import {SentryEvent} from '@sentry/browser';
import {SentryEventHint} from '@sentry/types';
import {ExtensionState} from '../background/background';
import {Actions} from './actions';


export function InitSentry (whereTag, listenStateFromBackground: boolean = false) {
    console.debug('[SENTRY] Attempt to init sentry');

    // we must set it even in case sentry is not initialized
    globalThis.Sentry = Sentry;


    if (!environment.sentry.dsn) {
        console.log('[SENTRY] sentry is disables');
        return Sentry;
    }

    function onMessage (request) {
        console.debug('[SENTRY] onMessage', request);
        if (request.type === Actions.extensionStateUpdated && request.state) {
            return updateScope(request.state);
        }
    }

    function updateScope (state: ExtensionState) {
        const {currentUser, ...extra} = state;
        Sentry.configureScope(scope => {
            scope.setExtra('state', extra);
            scope.setTag('where', whereTag);
            scope.setUser(currentUser);
        });
    }

    Sentry.init({
        dsn: environment.sentry.dsn,
        environment: 'extension',
        beforeSend (event: SentryEvent, hint?: SentryEventHint): SentryEvent | Promise<SentryEvent | null> | null {
            if (hint
                && hint.originalException
                && !window.navigator.onLine
                && typeof hint.originalException === 'object'
                && hint.originalException.message === 'Network error: Failed to fetch') {
                return null;
            }
            return event;
        }
    });

    if (listenStateFromBackground) {
        chrome.runtime.sendMessage({type: Actions.getExtensionState}, updateScope);
        chrome.runtime.onMessage.addListener(onMessage);
    }
    return Sentry;
}
