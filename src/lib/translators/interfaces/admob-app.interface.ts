import {AdMobPlatform} from '../admob.constants';


export enum Host {
    UNKNOWN = 0,
    ADMOB = 1,
    AD_MANAGER = 2
}

export interface SessionContext {
    host: Host.ADMOB,
    publisherCode: string
}

export interface RequestHeader {
    context: SessionContext
}

export interface AppCreateRequest {
    requestHeader: RequestHeader
    app: AdMobApp
}

export interface AppCreateResponse {
    app: AdMobApp
}

export interface PlatformTypeContext {
    platform: PlatformContext
}

export interface PlatformContext {
    type: AdMobPlatform
}

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
    enhancedReportingEnabled?: boolean,
    userMetricsStatus: UserMetricsStatus,
    policyData: any,
    platformType: AdMobPlatform,
    hasAppStoreDetailsLink: boolean,
    publisherId: string,
    appStoreDetailsLinkId: string,
}

export enum UserMetricsStatus {
    DISABLED = 3
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
