import {AppodealApp} from 'core/appdeal-api/interfaces/appodeal-app.interface';
import {AdMobAdUnit} from 'lib/translators/interfaces/admob-ad-unit.interface';
import {AdMobApp} from 'lib/translators/interfaces/admob-app.interface';


/**
 * contain data required toSync process
 * InMemory implementation
 *
 */
export class SyncContext {

    private adMob: {
        apps: AdMobApp[];
        adUnits: AdMobAdUnit[]
    };
    private appodealApps: AppodealApp[] = [];

    constructor () {}

    getAdmobState () {
        return this.adMob;
    }

    // apps

    loadAdMob (adMob: {
        apps: AdMobApp[];
        adUnits: AdMobAdUnit[];
    }) {
        this.adMob = adMob;
    }

    addAdMobApp (adMobApp: AdMobApp) {
        this.adMob.apps.push(adMobApp);
    }

    updateAdMobApp (adMobApp: AdMobApp) {
        const index = this.adMob.apps.findIndex(v => v.appId === adMobApp.appId);
        this.adMob.apps[index] = adMobApp;
    }

    addAdMobAdUnit (adMobAdUnit: AdMobAdUnit) {
        this.adMob.adUnits.push(adMobAdUnit);
    }

    getActiveAdmobApps () {
        return this.adMob.apps.filter(app => !app.hidden);
    }

    getHiddenAppsWithStoreLink () {
        return this.adMob.apps.filter(app => Number(app.hasAppStoreDetailsLink) > 1 && app.hidden);
    }

    // ad units

    removeAdMobAdUnits (ids: string[]) {
        this.adMob.adUnits = this.adMob.adUnits.filter(v => !ids.includes(v.adUnitId));
    }

    getAdMobAppActiveAdUnits (adMobApp: AdMobApp): AdMobAdUnit[] {
        return this.adMob.adUnits.filter(adUnit => adUnit.appId === adMobApp.appId && !adUnit.archived);
    }

    // appodeal

    getAppodealAppsCount () {
        return this.appodealApps.length;
    }

    getAppodealApps () {
        return this.appodealApps;
    }

    addAppodealApps (apps: AppodealApp[] | AppodealApp) {
        this.appodealApps.push(...(
            Array.isArray(apps)
                ? apps
                : [apps]
        ));
        /// should be stored sorted
        this.appodealApps.sort(
            (a, b) => a.isDeleted === b.isDeleted
                ? (a.id > b.id ? -1 : 1)
                : (a.isDeleted > b.isDeleted ? -1 : 1)
        );

    }

}
