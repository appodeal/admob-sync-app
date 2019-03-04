export interface AdMobAdUnit {
    adUnitId: string,
    appId: string,
    name: string,
    refreshPeriodSeconds: number,
    archived: boolean,
    mediationEnabled: boolean,
    legacyAdmobSiteId: string,
    legacyAdLocationId: string,
    adFormat: AdMobAdFormat,
    liveEcpmEnabled: boolean,
    adType: number[],
    enableRewardsAds: boolean,
    rewardsSettings: RewardsSettings,

    googleOptimizedRefreshRate: number,

    cpmFloorSettings: CpmFloorSettings,
}

export enum AdMobAdFormat {
    NotFullScreen = 0,
    FullScreen = 1
}

export enum CpmFloorMode {
    Disabled = 1,
    Manual = 3
}

export interface CpmValue {
    // @see MicrosTranslator
    // in USD
    ecpm: number;
    currencyCode: 'USD';
}

export interface ManualFloorSettings {
    globalFloorValue?: CpmValue;
    // we dont use it
    regionFloorValue?: any[]
}

export interface CpmFloorSettings {
    floorMode: CpmFloorMode;
    optimized?: any;
    manual?: ManualFloorSettings;
}

export interface RewardsSettings {
    unitAmount: number;
    unitType: string;
    overrideMediationAdSourceRewardSettings: boolean;
}

export enum AdMobOs {
    IOS = 1,
    Android = 2
}

export interface AdMobApp {
    appId: string,
    name: string,
    platform: AdMobOs,
    applicationStoreId: string,
    publisherName?: string,
    // unknown
    vendor: number,
    iconUrl: string,
    price: any,
    archived?: boolean,
    downloadUrl?: string,
    description?: string,
    rating: number,
    numberRatings: number,
    // booleanLike
    hidden: boolean,
    // some object
    servingSettings: ServingSettings,
    applicationPackageName: string,
    firebaseSettings?: any,
    monetizationEngineInfo?: any,
    admobPlusEapEnabled: boolean,
    enhancedReportingEnabled?: boolean
}

export interface ServingSettings {
    positiveFilterUserListId?: number,
    negativeFilterUserListId?: number,
    frequencyCap?: any
    autoCollectLocationEnabled: boolean,
}

export interface MonetizationEngineInfo {
    eligible: any;
    projectedRevenueUpliftPercent: any
}

export interface AdMobUser {
    id: string,
    email: string,
    xsrfToken: string
}
