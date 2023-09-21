type ID = string;


export enum AppodealPlatform {
    IOS = 'IOS',
    ANDROID = 'ANDROID',
    AMAZON = 'AMAZON'
}

export interface AppodealApp {
    id: ID
    isDeleted: boolean
    name: string
    bundleId: string
    platform: AppodealPlatform;
    admobAppId: string;
    ecpmFloors: EcpmFloors[]
    customEventsList: any[]
}


export interface EcpmFloors {
    adType: AdType
    customEvents: CustomEvent[]
    ecpmFloor: number[]
    format: Format
    isThirdPartyBidding: boolean
}

export interface CustomEvent {
    className: string
    label: string
    params: string
    price: string
}

export enum AdType {
    INTERSTITIAL = 'INTERSTITIAL',
    VIDEO = 'VIDEO',
    BANNER = 'BANNER',
    NATIVE = 'NATIVE',
    MREC = 'MREC',
    REWARDED_VIDEO = 'REWARDED_VIDEO',
    REWARDED_INTERSTITIAL = 'REWARDED_INTERSTITIAL'
}

export enum Format {
    UNDEFINED = 'UNDEFINED',
    IMAGE = 'IMAGE',
    RICHMEDIA = 'RICHMEDIA',
    TEXT = 'TEXT',
    IMAGE_AND_TEXT = 'IMAGE_AND_TEXT',
    SIMPLE_VIDEO = 'SIMPLE_VIDEO',
    REWARDED = 'REWARDED'
}

export interface AppodealAdUnit {
    code: string;
    adType: AdType;
    format: Format;
    ecpmFloor: number;
    isThirdPartyBidding: boolean;
}
