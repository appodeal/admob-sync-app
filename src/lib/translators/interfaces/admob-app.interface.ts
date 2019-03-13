import {AdMobPlatform} from '../admob.constants';


export interface AdMobApp {
    appId: string,
    name: string,
    platform: AdMobPlatform,
    applicationStoreId: string,
    publisherName?: string,
    // same value as platform. set for published apps
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