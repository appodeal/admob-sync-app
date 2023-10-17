import {ArrayTranslator} from 'lib/translators/base-translators/array.translator';
import {ObjectTranslator} from 'lib/translators/base-translators/object.translator';
import {AdmobCustomEvent, AdmobCustomEventParam} from 'lib/translators/interfaces/admob-ad-unit.interface';
import {getTranslator} from 'lib/translators/translator.helpers';


export class AdmobCustomEventParamTranslator extends ObjectTranslator<AdmobCustomEventParam> {
    constructor () {
        super({
            1: 'key',
            2: 'value'
        });
    }
}

export class AdmobCustomEventParamsArrayTranslator extends ArrayTranslator<AdmobCustomEvent> {
    constructor () {
        super(getTranslator(AdmobCustomEventParamTranslator));
    }

}

export class AdmobCustomEventTranslator extends ObjectTranslator<AdmobCustomEvent> {

    constructor () {
        super({
            1: 'eventId',
            4: ['params', AdmobCustomEventParamsArrayTranslator],
            12: 'adUnitId',
            15: 'label'

        });
    }

}
