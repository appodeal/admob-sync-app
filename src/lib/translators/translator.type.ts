import {BooleanTranslator} from './boolean.translator';
import {MicrosToUSDTranslator} from './micros-to-usd.translator';
import {RawTranslator} from './raw.translator';
import {AppTranslator, MonetizationEngineInfoTranslator, ServingSettingsTranslator} from '../admob-app.translator';
import {
    AdUnitTranslator,
    CpmFloorSettingsTranslator,
    CpmValueTranslator,
    ManualFloorSettingsTranslator,
    RewardsSettingsTranslator
} from '../admop-ad-unit.translator';


export type Translator = typeof RawTranslator
    | typeof ServingSettingsTranslator
    | typeof MonetizationEngineInfoTranslator
    | typeof ManualFloorSettingsTranslator
    | typeof CpmValueTranslator
    | typeof CpmFloorSettingsTranslator
    | typeof MicrosToUSDTranslator
    | typeof RewardsSettingsTranslator
    | typeof BooleanTranslator
    | typeof AdUnitTranslator
    | typeof AppTranslator;
