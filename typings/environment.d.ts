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
    readonly multipleAccountsSupport: boolean;
    readonly updates: {
        releaseNotesUrl: string,
        updatesServerUrl: string,
        login: string,
        password: string
    };
}

declare const environment: Environment;
