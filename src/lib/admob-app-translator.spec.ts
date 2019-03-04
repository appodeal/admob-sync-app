import {AppTranslator} from 'lib/admob-app.translator';
import {getTranslator} from 'lib/translators/translator.helpers';


describe('AppTranslator', () => {
    it('should decode app', () => {

        expect(getTranslator(AppTranslator)
            .decode(
                {
                    '1': '6475065783',
                    '2': 't5',
                    '3': 2,
                    '4': '',
                    '6': 0,
                    '19': 1,
                    '21': {'6': 1},
                    '25': 0
                }))
            .toEqual({
                'admobPlusEapEnabled': false,
                'appId': '6475065783',
                'applicationStoreId': '',
                'hidden': true,
                'name': 't5',
                'platform': 2,
                'servingSettings': {'autoCollectLocationEnabled': true},
                'vendor': 0
            });

        expect(getTranslator(AppTranslator)
            .decode(
                {
                    '1': '5356892402',
                    '2': 'Twitter',
                    '3': 2,
                    '4': 'com.twitter.android',
                    '5': 'Twitter, Inc.',
                    '6': 2,
                    '7': '//lh3.googleusercontent.com/vcLs8gpbWZZ02Kr0rXN1jT5K-Z7Pv8GfRTUYWjJdgoD2Aq1NISwmSd-CE-YLJRSacNfQyikk',
                    '8': {'2': 'USD'},
                    '10': 'https://play.google.com/store/apps/details?id=com.twitter.android',
                    '12': 4.3074613,
                    '13': 12735145,
                    '19': 0,
                    '21': {'6': 1},
                    '22': 'com.twitter.android',
                    '25': 0
                }))
            .toEqual({
                    'admobPlusEapEnabled': false,
                    'appId': '5356892402',
                    'applicationPackageName': 'com.twitter.android',
                    'applicationStoreId': 'com.twitter.android',
                    'downloadUrl': 'https://play.google.com/store/apps/details?id=com.twitter.android',
                    'hidden': false,
                    'iconUrl': '//lh3.googleusercontent.com/vcLs8gpbWZZ02Kr0rXN1jT5K-Z7Pv8GfRTUYWjJdgoD2Aq1NISwmSd-CE-YLJRSacNfQyikk',
                    'name': 'Twitter',
                    'numberRatings': 12735145,
                    'platform': 2,
                    'price': {'2': 'USD'},
                    'publisherName': 'Twitter, Inc.',
                    'rating': 4.3074613,
                    'servingSettings': {'autoCollectLocationEnabled': true},
                    'vendor': 2
                }
            );

    });

    it('should get same result after being decoded and encoded app', () => {

        const appTranslator = <AppTranslator>getTranslator(AppTranslator);

        expect(appTranslator.encode(appTranslator.decode({
            '1': '6475065783',
            '2': 't5',
            '3': 2,
            '4': '',
            '6': 0,
            '19': 1,
            '21': {'6': 1},
            '25': 0
        }))).toEqual({
            '1': '6475065783',
            '2': 't5',
            '3': 2,
            '4': '',
            '6': 0,
            '19': 1,
            '21': {'6': 1},
            '25': 0
        });

        expect(appTranslator.encode(appTranslator.decode({
            '1': '5356892402',
            '2': 'Twitter',
            '3': 2,
            '4': 'com.twitter.android',
            '5': 'Twitter, Inc.',
            '6': 2,
            '7': '//lh3.googleusercontent.com/vcLs8gpbWZZ02Kr0rXN1jT5K-Z7Pv8GfRTUYWjJdgoD2Aq1NISwmSd-CE-YLJRSacNfQyikk',
            '8': {'2': 'USD'},
            '10': 'https://play.google.com/store/apps/details?id=com.twitter.android',
            '12': 4.3074613,
            '13': 12735145,
            '19': 0,
            '21': {'6': 1},
            '22': 'com.twitter.android',
            '25': 0
        }))).toEqual({
            '1': '5356892402',
            '2': 'Twitter',
            '3': 2,
            '4': 'com.twitter.android',
            '5': 'Twitter, Inc.',
            '6': 2,
            '7': '//lh3.googleusercontent.com/vcLs8gpbWZZ02Kr0rXN1jT5K-Z7Pv8GfRTUYWjJdgoD2Aq1NISwmSd-CE-YLJRSacNfQyikk',
            '8': {'2': 'USD'},
            '10': 'https://play.google.com/store/apps/details?id=com.twitter.android',
            '12': 4.3074613,
            '13': 12735145,
            '19': 0,
            '21': {'6': 1},
            '22': 'com.twitter.android',
            '25': 0
        });

    });


});
