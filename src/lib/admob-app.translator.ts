import {AdMobApp, MonetizationEngineInfo, ServingSettings} from 'interfaces/admob.interfaces';
import {BooleanTranslator} from 'lib/translators/boolean.translator';
import {ObjectTranslator} from 'lib/translators/object.translator';


export class ServingSettingsTranslator extends ObjectTranslator<ServingSettings> {
    constructor () {
        super({
            2: 'positiveFilterUserListId',
            3: 'negativeFilterUserListId',
            4: 'frequencyCap',
            6: ['autoCollectLocationEnabled', BooleanTranslator]
        });
    }
}


export class MonetizationEngineInfoTranslator extends ObjectTranslator<MonetizationEngineInfo> {
    constructor () {
        super({
            1: 'eligible',
            2: 'projectedRevenueUpliftPercent'
        });
    }
}


export class AppTranslator extends ObjectTranslator<AdMobApp> {

    constructor () {
        super({
            1: 'appId',
            2: 'name',
            3: 'platform',
            4: 'applicationStoreId',
            5: 'publisherName',
            6: 'vendor',
            7: 'iconUrl',
            8: 'price',
            9: ['archived', BooleanTranslator],
            10: 'downloadUrl',
            11: 'description',
            12: 'rating',
            13: 'numberRatings',
            19: ['hidden', BooleanTranslator],
            21: ['servingSettings', ServingSettingsTranslator],
            22: 'applicationPackageName',
            23: 'firebaseSettings',
            24: ['monetizationEngineInfo', MonetizationEngineInfoTranslator],
            25: ['admobPlusEapEnabled', BooleanTranslator],
            26: 'enhancedReportingEnabled'
        });
    }

}

