import {BooleanTranslator} from './base-translators/boolean.translator';
import {ObjectTranslator} from './base-translators/object.translator';
import {
    AdMobApp,
    AppCreateRequest,
    AppCreateResponse,
    MonetizationEngineInfo,
    PlatformContext,
    PlatformTypeContext,
    RequestHeader,
    ServingSettings,
    SessionContext,
} from './interfaces/admob-app.interface';


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

export class SessionContextTranslator extends ObjectTranslator<SessionContext> {
    constructor () {
        super({
            1: 'host',
            3: 'publisherCode'
        });
    }
}

export class RequestHeaderTranslator extends ObjectTranslator<RequestHeader> {
    constructor () {
        super({
            1: ['context', SessionContextTranslator]
        });
    }
}

export class AppCreateRequestTranslator extends ObjectTranslator<AppCreateRequest> {
    constructor () {
        super({
            1: ['requestHeader', RequestHeaderTranslator],
            2: ['app', AppTranslator]
        });
    }
}

export class AppCreateResponseTranslator extends ObjectTranslator<AppCreateResponse> {
    constructor () {
        super({
            2: ['app', AppTranslator]
        });
    }
}

export class PlatformTypeContextTranslator extends ObjectTranslator<PlatformTypeContext> {
    constructor () {
        super({
            0: ['platform', PlatformContextTranslator],
        });
    }
}

export class PlatformContextTranslator extends ObjectTranslator<PlatformContext> {
    constructor () {
        super({
            2: 'type',
        });
    }
}


export class AppTranslator extends ObjectTranslator<AdMobApp> {

    // All commented keys need to decode. These keys are used in different requests
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
            // 14: '',
            // 16: '',
            // 18: '',
            19: ['hidden', BooleanTranslator],
            21: ['servingSettings', ServingSettingsTranslator],
            22: 'applicationPackageName',
            23: 'firebaseSettings',
            24: ['monetizationEngineInfo', MonetizationEngineInfoTranslator],
            25: ['admobPlusEapEnabled', BooleanTranslator],
            26: 'enhancedReportingEnabled',
            27: 'userMetricsStatus',
            28: 'policyData',
            // 30: '',
            32: ['platformType', PlatformTypeContextTranslator],
            // 33: '',
            36: 'publisherId',
            // 38: '',
            // 39: '',
            // 41: '',
        });
    }

}

