import * as SentryElectron from '@sentry/electron';

import * as pkgInfo from '../../package.json';


export let Sentry = SentryElectron;

export function initBugTracker (sentryOptions: SentryOptions) {

    const useSentry = sentryOptions && sentryOptions.dsn;

    if (useSentry) {
        SentryElectron.init({
            ...sentryOptions,
            beforeSend (event, hint?) {

                event.release = pkgInfo.version;
                if (event.contexts.app) {
                    event.contexts.app['build_type'] = environment.development ? 'dev' : 'prod';
                }
                // to extend error context
                if (hint && hint.originalException) {
                    if (hint.originalException['extraInfo']) {
                        event.extra = {...(event.extra || {}), ...hint.originalException['extraInfo']};
                    }
                }
                return event;
            }
        });
    } else {
        process.on('uncaughtException', function (err: any) {
            console.error('Caught exception: ', err);
        });
        process.on('unhandledRejection', (reason, p) => {
            console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
            // application specific logging, throwing an error, or other logic here
        });
    }
}
