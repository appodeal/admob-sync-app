declare interface Services {
    readonly appodeal: string;
    readonly ad_mob: string;
}

interface SentryOptions {
    dsn: string;
}

declare interface Environment {
    readonly services: Services
    readonly sentry: SentryOptions
    readonly development: boolean;
    readonly settingsPage?: string;
    readonly basicAuth: {
        login: string,
        password: string
    };
    readonly updates: {
        releaseNotesUrl: string,
        updatesServerUrl: string
    };
}

declare const environment: Environment;
