import {AdType} from 'core/appdeal-api/interfaces/appodeal-app.interface';

import {AdMobAdFormat, AdMobAdUnit, CpmFloorMode} from 'lib/translators/interfaces/admob-ad-unit.interface';


const defaultAUnitTemplate: Partial<AdMobAdUnit> = {
    adFormat: AdMobAdFormat.FullScreen,
    // Image + text + video gif like with no sound
    adType: [0, 1, 2],
    googleOptimizedRefreshRate: false,
    cpmFloorSettings: {
        floorMode: CpmFloorMode.Disabled
    }
};

const bannerAdUnitTemplate: Partial<AdMobAdUnit> = {
    adFormat: AdMobAdFormat.NotFullScreen,
    // Image + text + video gif like with no sound
    adType: [0, 1, 2],
    googleOptimizedRefreshRate: false,
    cpmFloorSettings: {
        floorMode: CpmFloorMode.Disabled
    }
};

const nativeAdUnitTemplate: Partial<AdMobAdUnit> = {
    adFormat: AdMobAdFormat.Native,
    // Image + text + video gif like with no sound
    adType: [0, 1, 2],
    googleOptimizedRefreshRate: false,
    cpmFloorSettings: {
        floorMode: CpmFloorMode.Disabled
    }
};

const rewardedVideoAdUnitTemplate: Partial<AdMobAdUnit> = {
    adFormat: AdMobAdFormat.FullScreen,
    enableRewardsAds: true,
    // rewarded videos + interactive
    adType: [1, 2],
    rewardsSettings: {unitAmount: '1', unitType: 'reward', overrideMediationAdSourceRewardSettings: true},
    googleOptimizedRefreshRate: false,
    cpmFloorSettings: {
        floorMode: CpmFloorMode.Disabled
    }
};

export function getAdUnitTemplate (adType: AdType) {
    switch (adType) {
        case AdType.INTERSTITIAL:
            return defaultAUnitTemplate;
        case AdType.BANNER:
        case AdType.MREC:
            return bannerAdUnitTemplate;
        case AdType.REWARDED_VIDEO:
            return rewardedVideoAdUnitTemplate;
        case AdType.NATIVE:
            return nativeAdUnitTemplate;
        default:
            return null;
    }
}
