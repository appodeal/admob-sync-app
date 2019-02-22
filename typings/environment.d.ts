declare interface Services {
    readonly appodeal: string;
    readonly ad_mob: string;
}

declare interface Environment {
    readonly services: Services
    readonly development: boolean;
    readonly settingsPage?: string
}

declare const environment: Environment;
