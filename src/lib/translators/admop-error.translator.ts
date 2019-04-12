import {ObjectTranslator} from './base-translators/object.translator';
import {AdmobError} from './interfaces/admob-ad-unit.interface';


export class AdmobErrorTranslator extends ObjectTranslator<AdmobError> {

    constructor () {
        super({
            2: 'message',
            5: 'code'
        });
    }

}
