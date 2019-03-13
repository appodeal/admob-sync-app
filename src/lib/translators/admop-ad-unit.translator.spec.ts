import {AdUnitTranslator} from './admop-ad-unit.translator';
import {getTranslator} from './translator.helpers';


describe('AdUnitTranslator', () => {
    it('should decode Adunit', () => {

        expect(getTranslator(AdUnitTranslator)
            .decode(
                {
                    '1': '8960794176',
                    '2': '8085808155',
                    '3': 'tttttt inetr',
                    '9': 0,
                    '11': 0,
                    '14': 1,
                    '15': 1,
                    '16': [0, 1, 2],
                    '17': 0,
                    '21': 0,
                    '23': {'1': 1}
                }))
            .toEqual({
                'adFormat': 1,
                'adType': [0, 1, 2],
                'adUnitId': '8960794176',
                'appId': '8085808155',
                'archived': false,
                'cpmFloorSettings': {'floorMode': 1},
                'enableRewardsAds': false,
                'googleOptimizedRefreshRate': 0,
                'liveEcpmEnabled': true,
                'mediationEnabled': false,
                'name': 'tttttt inetr'
            });

        expect(getTranslator(AdUnitTranslator)
            .decode({
                '1': '3385335180',
                '2': '4043810730',
                '3': 'Appodeal/146649/rewarded_video/rewarded/7',
                '9': 0,
                '11': 0,
                '14': 1,
                '15': 1,
                '16': [1, 2],
                '17': 1,
                '18': {'1': '1', '2': 'reward', '3': 1},
                '21': 0,
                '23': {'1': 3, '3': {'1': {'1': '7000000', '2': 'USD'}}}
            }))
            .toEqual({
                    'adFormat': 1,
                    'adType': [1, 2],
                    'adUnitId': '3385335180',
                    'appId': '4043810730',
                    'archived': false,
                    'cpmFloorSettings': {'floorMode': 3, 'manual': {'globalFloorValue': {'currencyCode': 'USD', 'ecpm': 7}}},
                    'enableRewardsAds': true,
                    'googleOptimizedRefreshRate': 0,
                    'liveEcpmEnabled': true,
                    'mediationEnabled': false,
                    'name': 'Appodeal/146649/rewarded_video/rewarded/7',
                    'rewardsSettings': {'overrideMediationAdSourceRewardSettings': true, 'unitAmount': '1', 'unitType': 'reward'}
                }
            );

    });

    it('should get same result after being decoded and encoded app', () => {

        const appTranslator = <AdUnitTranslator>getTranslator(AdUnitTranslator);

        expect(appTranslator.encode(appTranslator.decode({
            '1': '8960794176',
            '2': '8085808155',
            '3': 'tttttt inetr',
            '9': 0,
            '11': 0,
            '14': 1,
            '15': 1,
            '16': [0, 1, 2],
            '17': 0,
            '21': 0,
            '23': {'1': 1}
        }))).toEqual({
            '1': '8960794176',
            '2': '8085808155',
            '3': 'tttttt inetr',
            '9': 0,
            '11': 0,
            '14': 1,
            '15': 1,
            '16': [0, 1, 2],
            '17': 0,
            '21': 0,
            '23': {'1': 1}
        });

        expect(appTranslator.encode(appTranslator.decode({
            '1': '3385335180',
            '2': '4043810730',
            '3': 'Appodeal/146649/rewarded_video/rewarded/7',
            '9': 0,
            '11': 0,
            '14': 1,
            '15': 1,
            '16': [1, 2],
            '17': 1,
            '18': {'1': '1', '2': 'reward', '3': 1},
            '21': 0,
            '23': {'1': 3, '3': {'1': {'1': '7000000', '2': 'USD'}}}
        }))).toEqual({
            '1': '3385335180',
            '2': '4043810730',
            '3': 'Appodeal/146649/rewarded_video/rewarded/7',
            '9': 0,
            '11': 0,
            '14': 1,
            '15': 1,
            '16': [1, 2],
            '17': 1,
            '18': {'1': '1', '2': 'reward', '3': 1},
            '21': 0,
            '23': {'1': 3, '3': {'1': {'1': '7000000', '2': 'USD'}}}
        });


    });


});
