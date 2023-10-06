import {BooleanTranslator} from './base-translators/boolean.translator';
import {MicrosToUSDTranslator} from './base-translators/micros-to-usd.translator';

import {ObjectTranslator} from './base-translators/object.translator';
import {AdMobAdUnit, CpmFloorSettings, CpmValue, ManualFloorSettings, RewardsSettings} from './interfaces/admob-ad-unit.interface';
import {BiddingTranslator} from "./base-translators/bidding.translator";


export class RewardsSettingsTranslator extends ObjectTranslator<RewardsSettings> {

    constructor () {
        super({
            1: 'unitAmount',
            2: 'unitType',
            3: ['overrideMediationAdSourceRewardSettings', BooleanTranslator]
        });
    }

}

export class CpmValueTranslator extends ObjectTranslator<CpmValue> {

    constructor () {
        super({
            1: ['ecpm', MicrosToUSDTranslator],
            2: 'currencyCode'
        });
    }

}


export class ManualFloorSettingsTranslator extends ObjectTranslator<ManualFloorSettings> {

    constructor () {
        super({
            1: ['globalFloorValue', CpmValueTranslator],
            2: 'regionFloorValue'
        });
    }

}

export class CpmFloorSettingsTranslator extends ObjectTranslator<CpmFloorSettings> {

    constructor () {
        super({
            1: 'floorMode',
            2: 'optimized',
            3: ['manual', ManualFloorSettingsTranslator]
        });
    }
}


export class AdUnitTranslator extends ObjectTranslator<AdMobAdUnit> {

    constructor () {
        super({
            1: 'adUnitId',
            2: 'appId',
            3: 'name',
            6: 'refreshPeriodSeconds',
            9: ['archived', BooleanTranslator],
            11: ['mediationEnabled', BooleanTranslator],
            12: 'legacyAdmobSiteId',
            13: 'legacyAdLocationId',
            14: 'adFormat',
            15: ['liveEcpmEnabled', BooleanTranslator],
            16: 'adType',
            17: ['enableRewardsAds', BooleanTranslator],
            18: ['rewardsSettings', RewardsSettingsTranslator],
            19: 'frequencyCap',
            21: 'googleOptimizedRefreshRate',
            22: 'usageSummary',
            23: ['cpmFloorSettings', CpmFloorSettingsTranslator],
            27: ['isThirdPartyBidding', BiddingTranslator],
        });
    }

}
