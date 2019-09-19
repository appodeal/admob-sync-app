declare interface Services {
    readonly appodeal: string;
    readonly appodeal_auth: string;
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
        updatesServerUrl: string
    };
    readonly setupOptions: Readonly<{
        tutorialUrl: string,
        projectName: string,
        appName: string,
        clientName: string,
        domains: Array<string>,
        allowedJs: Array<string>,
        allowedCallbacks: Array<string>
    }>;
}

declare const environment: Environment;

declare const DEV_MODE: boolean;
