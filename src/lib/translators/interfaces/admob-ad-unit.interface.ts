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
    frequencyCap: any
    googleOptimizedRefreshRate: boolean,

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
    unitAmount: string;
    unitType: string;
    overrideMediationAdSourceRewardSettings: boolean;
}
