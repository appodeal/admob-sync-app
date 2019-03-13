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
}


export interface EcpmFloors {
    adType: AdType;
    format: Format;
    ecpmFloor: number[]
}

export enum AdType {
    INTERSTITIAL = 'INTERSTITIAL',
    VIDEO = 'VIDEO',
    BANNER = 'BANNER',
    NATIVE = 'NATIVE',
    MREC = 'MREC',
    REWARDED_VIDEO = 'REWARDED_VIDEO'
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
}
