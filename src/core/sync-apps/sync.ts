import {captureMessage} from '@sentry/core';
import {AdmobApiService, RefreshXsrfTokenError, UpdateRequest, UpdateResponse} from 'core/admob-api/admob.api';
import {CustomEventApiService} from 'core/admob-api/custom-event.api';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {
    AdType,
    AppodealAdUnit,
    AppodealApp,
    AppodealPlatform,
    CustomEvent,
    Format,
} from 'core/appdeal-api/interfaces/appodeal-app.interface';
import {getAdUnitTemplate} from 'core/sync-apps/ad-unit-templates';
import {SyncStats} from 'core/sync-apps/sync-stats';
import stringify from 'json-stable-stringify';
import {retryProxy} from 'lib/retry';
import {
    AppCreateRequestTranslator,
    AppCreateResponseTranslator,
    AppTranslator,
} from 'lib/translators/admob-app.translator';
import {AdmobCustomEventTranslator} from 'lib/translators/admob-event-translator';
import {AdMobPlatform} from 'lib/translators/admob.constants';
import {AdUnitTranslator} from 'lib/translators/admop-ad-unit.translator';
import {
    AdMobAdUnit,
    AdmobCustomEvent,
    CpmFloorMode,
    CpmFloorSettings,
} from 'lib/translators/interfaces/admob-ad-unit.interface';
import {
    AdMobApp,
    AppCreateRequest,
    AppCreateResponse,
    Host,
    UserMetricsStatus,
} from 'lib/translators/interfaces/admob-app.interface';
import {getTranslator} from 'lib/translators/translator.helpers';
import uuid from 'uuid';
import {AdMobAccount} from '../appdeal-api/interfaces/admob-account.interface';
import {AppodealAccount} from '../appdeal-api/interfaces/appodeal.account.interface';
import {NoConnectionError} from '../error-factory/errors/network/no-connection-error';
import {UnavailableEndpointError} from '../error-factory/errors/network/unavailable-endpoint-error';
import {SyncContext} from './sync-context';
import {SyncEventEmitter} from './sync-event.emitter';
import {SyncRunner} from './sync-runner';
import {SyncErrorEvent, SyncEvent, SyncEventsTypes, SyncReportProgressEvent, SyncStopEvent} from './sync.events';
import escapeStringRegexp = require('escape-string-regexp');
import {Simulate} from 'react-dom/test-utils';
import error = Simulate.error;


const isObject = (v) => v !== null && typeof v === 'object';

type AdUnitTemplateId = string;
type AdUnitId = string;

interface AppodealAppToSync extends AppodealApp {
    admobApp: AdMobApp;
    subProgressCurrent: number;
    subProgressTotal: number;
    adUnitTemplatesToCreate: Map<AdUnitTemplateId, AdUnitTemplate>;
    adUnitsToDelete: AdUnitId[];
    appodealAdUnits: any[];
    oldGoodAdUnits: AdMobAdUnit[];
    adUnitsToUpdateName: AdMobAdUnit[];
    synced: boolean;
}

const MAX_APP_NAME_LENGTH = 80;

interface AdUnitTemplate extends Partial<AdMobAdUnit> {
    __metadata: {
        ecpmFloor: number;
        adType: AdType;
        format: Format;
        customEvents?: CustomEvent[],
    };
}

const CustomEventPlatform = {
    [AppodealPlatform.IOS]: '13',
    [AppodealPlatform.ANDROID]: '12',
    // same as ANDROID
    [AppodealPlatform.AMAZON]: '12',
};

enum PlatformGroup {
    'IOS' = 1,
    'ANDROID' = 2,
    'AMAZON' = 2,
}

const defaultAdUnitPrefix = 'Appodeal';

export class Sync {

    public events = new SyncEventEmitter();

    /**
     * if there is any error during the sync
     */
    public hasErrors = false;
    private terminated = true;


    public readonly stats = new SyncStats(this);

    public context = new SyncContext();

    private apps: AppodealAppToSync[];
    private syncedAppCount = 0;
    private failedAppCount = 0;

    /**
     * if user have no permissions to create native adunits we should not try do it many times.
     */
    private skipNativeAdUnits = false;

    constructor(
        // With retry proxy
        // each failed request will be retried 3 times automatically
        private adMobApi: AdmobApiService,
        private appodealApi: AppodealApiService,
        public adMobAccount: AdMobAccount,
        private appodealAccount: AppodealAccount,
        private logger: Partial<Console>,
        private customEventApi: CustomEventApiService,
        // some uniq syncId
        public readonly id: string,
        public readonly runner: SyncRunner,
    ) {
        this.id = id || uuid.v4();
        this.beforeRun();
    }

    async stop(reason: string) {
        if (this.terminated) {
            this.logger.info(`Sync already stopped. New Stop Reason: ${reason}`);
            return;
        }
        this.terminated = true;
        this.stats.terminated = true;
        this.logger.info(`Stopping Sync Reason: ${reason}`);
    }

    beforeRun() {
        const retryCondition = e =>
            e.message.substring(0, 'net::ERR'.length) === 'net::ERR'
            || e instanceof NoConnectionError
            || e instanceof UnavailableEndpointError;

        const terminateIfConnectionLost = e => {
            if (retryCondition(e)) {
                this.stop('Seems to be disconnected. ' + (e && e.message ? e.message : JSON.stringify(e)));
            }
        };

        this.adMobApi = retryProxy(this.adMobApi, retryCondition, 3, 5000, terminateIfConnectionLost);
        this.appodealApi = retryProxy(this.appodealApi, retryCondition, 3, 5000, terminateIfConnectionLost);
    }

    async run() {
        this.logger.info(`Sync started`);
        this.terminated = false;
        try {
            for await (const value of this.doSync()) {
                this.logger.info(value);
                if (this.terminated) {
                    this.logger.info(`Sync Terminated`);
                    return;
                }
            }
            this.logger.info(`Sync finished completely ${this.hasErrors ? 'with ERRORS!' : ''}`);
        } catch (e) {
            this.hasErrors = true;
            throw e;
        } finally {
            this.finish();
        }
    }

    finish() {
        try {
            this.stats.end();
            this.emitStop();
            this.appodealApi.reportSyncEnd(this.id);
        } catch (e) {
            this.logger.error('Failed to finish ', e);
        }
    }

    emit(event: SyncEvent | SyncEventsTypes) {
        try {
            if (isObject(event)) {
                (<SyncEvent>event).id = this.id;
                (<SyncEvent>event).accountId = this.adMobAccount.id;
                return this.events.emit(<SyncEvent>event);
            }
            return this.events.emit({type: <SyncEventsTypes>event, id: this.id, accountId: this.adMobAccount.id});
        } catch (e) {
            this.logger.error('Failed to emit ', e);
        }
    }

    emitProgress() {
        try {
            const progress: Partial<SyncReportProgressEvent> = {};
            progress.synced = this.syncedAppCount;
            progress.failed = this.failedAppCount;
            progress.total = this.apps.length;

            const currentProgress = this.apps.reduce(
                (acc, app) => acc + (app.synced ? 2 + app.subProgressTotal : Math.min(app.subProgressCurrent, app.subProgressTotal)),
                0,
            );

            const totalProgress = this.apps.reduce((acc, app) => acc + 2 + app.subProgressTotal, 0);

            progress.percent = Math.round(currentProgress / totalProgress * 100);
            progress.type = SyncEventsTypes.ReportProgress;
            return this.emit(<SyncReportProgressEvent>progress);
        } catch (e) {
            this.logger.error('Failed to emitProgress ', e);
        }
    }

    emitError(error: Error) {
        this.hasErrors = true;
        return this.emit(<SyncErrorEvent>{
            type: SyncEventsTypes.Error,
            error,
        });
    }

    emitStop() {
        return this.emit(<SyncStopEvent>{
            type: SyncEventsTypes.Stopped,
            terminated: this.terminated,
            hasErrors: this.hasErrors,
        });
    }

    async* doSync() {
        try {
            this.stats.start();
            this.emit(SyncEventsTypes.Started);
            this.logger.info(`Sync Params
        uuid: ${this.id}
        AppodealAccount: 
            id: ${this.appodealAccount.id}
        AdmobAccount: 
            id: ${this.adMobAccount.id}
            email: ${this.adMobAccount.email}
        `);
            await this.appodealApi.reportSyncStart(this.id, this.adMobAccount.id);
        } catch (e) {
            this.logger.error('Failed to doSync ', e);
        }

        try {
            yield* this.fetchDataToSync();
        } catch (e) {
            this.logger.error('Failed to fetchDataToSync ', e);
            this.emitError(e);
            this.emitStop();
            return;
        }

        try {
            yield* this.syncApps();
        } catch (e) {
            this.logger.error('Failed to syncApps ', e);
            this.emitError(e);
            this.emitStop();
            return;
        }
    }

    async* fetchDataToSync() {


        yield `refrech Admob xsrf Token`;
        let pageBody: string;
        try {
            pageBody = await this.adMobApi.fetchHomePage().then(response => response.text());
            this.adMobApi.refreshXsrfToken(pageBody);
            this.customEventApi.refreshXsrfToken(pageBody);

            const body = await this.adMobApi.fetchCamApiAppsSettings(this.adMobAccount.id).then(response => response.text());
            this.adMobApi.setCamApiXsrfToken(this.adMobApi.ejectCamApiXsrfToken(body));


        } catch (e) {
            if (e instanceof RefreshXsrfTokenError) {
                // this error is not supposed to be emitted and handler further
                this.hasErrors = true;
                this.logger.error(e);
            } else {
                this.emitError(e);
            }
            this.emit(SyncEventsTypes.UserActionsRequired);
            await this.stop('Terminated as User Actions is Required');
            yield 'Terminated as User Actions is Required';
            return;
        }

        yield `Admob xsrf Token Updated`;

        this.emit(SyncEventsTypes.CalculatingProgress);


        yield `Fetch Admob Apps and AdUnits`;

        this.context.loadAdMob({
            apps: await this.ejectAppsAppsFromAdmob(),
            adUnits: await this.ejectAdUnitsFromAdmob(),
        });
        yield 'Admob Apps and AdUnits fetched';


        const accountDetails = await this.appodealApi.fetchApps(this.adMobAccount.id);
        this.context.addAppodealApps(accountDetails.apps.nodes);
        yield `Appodeal Apps page 1/${accountDetails.apps.pageInfo.totalPages} fetched`;

        if (accountDetails.apps.pageInfo.totalPages) {
            for (let pageNumber = 2; pageNumber <= accountDetails.apps.pageInfo.totalPages; pageNumber++) {
                const page = await this.appodealApi.fetchApps(this.adMobAccount.id, pageNumber);
                this.context.addAppodealApps(page.apps.nodes);
                yield `Appodeal Apps page ${pageNumber}/${page.apps.pageInfo.totalPages} fetched`;
            }
        }

        this.logger.info(`Total Appodeal apps to Sync ${this.context.getAppodealApps().length}`);

        yield `All Appodeal Apps fetched`;
    }

    async ejectAppsAppsFromAdmob(): Promise<AdMobApp[]> {
        let appsListJson: string = JSON.stringify(await this.adMobApi.getApps());
        if (!appsListJson) {
            // may be user's action required
            throw new Error('Apps not found');
        }

        try {
            const apps = <any[]>JSON.parse(appsListJson)[1] || [];
            return apps.map<AdMobApp>(getTranslator(AppTranslator).decode);
        } catch (e) {
            console.log('appsJson', appsListJson);
            console.error(e);
            throw e;
        }
    }

    async ejectAdUnitsFromAdmob(): Promise<AdMobAdUnit[]> {
        let adMobAdUnitJson = JSON.stringify(await this.getCreatedAdUnitsList([]));

        if (!adMobAdUnitJson) {
            // may be user's action required
            throw new Error('AdUnits not found');
        }
        try {
            const adUnits = <any[]>JSON.parse(adMobAdUnitJson)[1] || [];
            return adUnits.map<AdMobAdUnit>(getTranslator(AdUnitTranslator).decode);
        } catch (e) {
            console.log('appsJson', adMobAdUnitJson);
            console.error(e);
            throw e;
        }
    }

    prepareApps(apps) {

        const prepareAppDataToSync = (app: AppodealAppToSync) => {
            try {
                app.subProgressCurrent = 0;
                app.subProgressTotal = 0;

                app.adUnitsToDelete = [];
                app.appodealAdUnits = [];
                app.oldGoodAdUnits = [];
                app.adUnitsToUpdateName = [];
                app.adUnitTemplatesToCreate = new Map();

                app.customEventsList = [];

                if (app.isDeleted) {
                    return app;
                }

                const adMobApp = app.admobApp = this.findAdMobApp(app, this.context.getActiveAdmobApps());
                app.adUnitTemplatesToCreate = this.buildAdUnitsSchema(app);


                if (!app.admobApp) {
                    return app;
                }

                this.getActiveAdmobAdUnitsCreatedByApp(app, adMobApp).forEach((adMobAdUnit: AdMobAdUnit) => {
                    const templateId = Sync.getAdUnitTemplateId(adMobAdUnit);
                    if (app.adUnitTemplatesToCreate.has(templateId)) {
                        app.oldGoodAdUnits.push(adMobAdUnit);
                        app.appodealAdUnits.push(this.convertToAppodealAdUnit(adMobAdUnit, app.adUnitTemplatesToCreate.get(templateId)));
                        app.adUnitTemplatesToCreate.delete(templateId);
                    } else {
                        app.adUnitsToDelete.push(adMobAdUnit.adUnitId);
                    }
                });
                app.adUnitsToUpdateName = app.oldGoodAdUnits.filter(
                    adMobAdUnit => adMobAdUnit.name.substr(0, this.adUnitNamePrefix.length) !== this.adUnitNamePrefix,
                );

                // fill customEventsList

                return app;
            } catch (e) {
                this.logger.error('Failed to prepareAppDataToSync ', e);
            }
        };

        const calculateTotal = app => {
            app.subProgressTotal += app.adUnitTemplatesToCreate.size + app.adUnitsToUpdateName.length;

            return app;
        };


        try {
            return apps
                .map(prepareAppDataToSync)
                .map(calculateTotal);
        } catch (e) {
            this.logger.error('Failed to prepareApps ', e);
        }
    }

    async* syncApps() {

        const apps = this.apps = this.prepareApps(this.context.getAppodealApps());

        this.emitProgress();

        for (const app of apps) {
            try {
                this.logger.info('------------------------');
                yield* this.syncApp(app);
                this.syncedAppCount++;
            } catch (e) {
                this.stats.errorWhileSync(app);
                this.failedAppCount++;
                this.logger.error('Failed to syncApps ', e);
                this.emitError(e);
                yield `Failed to sync App [${app.id}] ${app.name}`;
            }
            app.synced = true;
            this.emitProgress();
        }
        this.logger.info('------------------------');
    }


    static toAdMobPlatform(app: AppodealApp): AdMobPlatform {
        if (app.platform === AppodealPlatform.IOS) {
            return AdMobPlatform.IOS;
        }
        return AdMobPlatform.Android;
    }

    async* syncDeletedApp(app: AppodealApp, adMobApp: AdMobApp) {
        if (!adMobApp) {
            this.logger.info('deleted App not found in admob');
            return;
        }
        yield `found App in Admob Try to delete its AdUnits`;

        const adUnitsToDelete = [];
        const adUnitsBiddingToDelete = [];

        this.getActiveAdmobAdUnitsCreatedByApp(app, adMobApp).map(adUnit => {
            if (!adUnit.isThirdPartyBidding) {
                adUnitsToDelete.push(adUnit.adUnitId);
            }

            if (adUnit.isThirdPartyBidding) {
                adUnitsBiddingToDelete.push(adUnit.adUnitId);
            }
        });

        if (adUnitsToDelete.length) {
            try {
                await this.deleteAdMobAdUnits(adUnitsToDelete);
                this.context.removeAdMobAdUnits(adUnitsToDelete);
                this.stats.appDeleted(app);
                yield `${adUnitsToDelete.length} adUnits deleted`;
            } catch (e) {
                this.logger.error('Failed to adUnitsToDelete ', e);
                yield `Failed to adUnitsToDelete ${e}`;
            }
        } else {
            yield `No AdUnits to delete`;
        }

        if (adUnitsBiddingToDelete.length) {
            try {
                await this.deleteAdMobAdUnitsBidding(adUnitsBiddingToDelete);
                this.context.removeAdMobAdUnits(adUnitsBiddingToDelete);
                this.stats.appDeleted(app);
                yield `${adUnitsBiddingToDelete.length} adUnits deleted`;
            } catch (e) {
                this.logger.error('Failed to adUnitsBiddingToDelete ', e);
                yield `Failed to adUnitsBiddingToDelete ${e}`;
            }
        } else {
            yield `No AdUnits to delete`;
        }

        // in case app has at least one active adUnit it should no be hidden
        if (!adMobApp.hidden && !this.context.getAdMobAppActiveAdUnits(adMobApp).length) {
            try {
                yield `Hide App. All its adUnits are archived`;
                adMobApp = await this.hideAdMobApp(adMobApp);
                this.context.updateAdMobApp(adMobApp);
                this.stats.appDeleted(app);
                yield `App Hidden`;
            } catch (e) {
                this.logger.error('Failed to adUnitsBiddingToDelete ', e);
                yield `Failed to Hide App ${e}`;
            }
        }
    }

    async* syncApp(app: AppodealAppToSync) {
        yield `Start Sync App [${app.id}] ${app.name}`;

        let adMobApp = this.findAdMobApp(app, this.context.getActiveAdmobApps());
        if (adMobApp) {
            this.logger.info(`Appodeal App [${app.id}] ${app.name} -> AdMobApp [${adMobApp.appId}] ${adMobApp.name}`);
        }

        if (app.isDeleted) {
            yield* this.syncDeletedApp(app, adMobApp);
            this.logger.info(`deleted app [${app.id}] ${app.name} sync finished`);
            return;
        }

        if (!adMobApp) {
            this.logger.info(`Unable to find App. Try to create new`);
            adMobApp = await this.createAdMobApp(app, this.adMobAccount.id);
            this.context.addAdMobApp(adMobApp);
            this.stats.appCreated(app);
            yield `App created`;
        }

        if (adMobApp.hidden && adMobApp.applicationPackageName) {
            adMobApp = await this.showAdMobApp(adMobApp);
            this.context.updateAdMobApp(adMobApp);
            this.stats.appUpdated(app);
            yield `Hidden App has been shown`;
        }

        /**
         * !!! IMPORTANT !!!
         * Admob Does not support amazon platfrom
         * so we create amazon Apps with Android platform
         * and we should not link this apps with google play!!!
         */
        if (!adMobApp.applicationStoreId && app.platform !== AppodealPlatform.AMAZON) {
            this.logger.info(`Search app in ${app.platform === AppodealPlatform.ANDROID ? 'Google Play' : 'App Store'}`);
            try {
                adMobApp = await this.linkAppWithStore(app, adMobApp);
                this.context.updateAdMobApp(adMobApp);
            } catch (e) {
                // log error & go further
                this.logger.info(`Error while linking app with store`);
                this.logger.error(e);
                this.emitError(e);
            }
        }
        // app has default name & does not match with app in Google play or App store
        if (!adMobApp.applicationStoreId) {
            if (this.appNameRegExp(app).test(adMobApp.name)
                && adMobApp.name.substr(0, this.adUnitNamePrefix.length) !== this.adUnitNamePrefix
            ) {
                const oldName = adMobApp.name;
                adMobApp = await this.updateAdMobAppName(adMobApp, this.patchNamePrefix(adMobApp.name));
                this.context.updateAdMobApp(adMobApp);
                this.stats.appUpdated(app);
                yield `App Name prefix updated [${app.id}] from ${oldName} to ${adMobApp.name}`;
            }
        }

        const actualAdUnits = yield* this.syncAdUnits(app, adMobApp);
        yield `AdUnits actualized`;

        yield* this.syncCustomEvents(app);
        yield `CustomEvents actualized`;

        await this.appodealApi.reportAppSynced(app, this.id, this.adMobAccount.id, adMobApp, actualAdUnits);
        yield `End Sync  App [${app.id}] ${app.name}`;
    }

    createdGroupList;

    async* syncCustomEvents(app: AppodealAppToSync) {
        let adUnitsForCustomEvents = this.adUnitsForCustomEvents(app);

        // events
        const createdCustomEvents = await this.getCustomEventsList();
        const allEventEventsForAllApps: AdmobCustomEvent[] = (createdCustomEvents[1] || []).map(x => getTranslator(
            AdmobCustomEventTranslator).decode(x) as AdmobCustomEvent);

        // groups
        this.createdGroupList = await this.getCreatedMediationGroup();

        //  create events
        for (const adUnit of adUnitsForCustomEvents) {

            if (adUnit.customEvents.length > 0) {

                // split to chunks by 50 event in each request
                let splitCustomEventsList = this.slicingListCustomEvents(adUnit.customEvents);
                for (const itemEvents of splitCustomEventsList) {
                    let payload = {
                        ...adUnit,
                        adUnitId: adUnit.internalAdmobAdUnitId,
                        customEvents: [...itemEvents],
                        admobExistingCustomEvents: allEventEventsForAllApps.filter(e => e.adUnitId === adUnit.adUnitId),
                    };

                    // removing groups before updating the event class_name
                    await this.removeMediationGroups(payload);

                    this.prepareAdUnitForCreateGroup(await this.createCustomEvents(payload), adUnit);
                }
            }
        }

        await this.createGroups(app, adUnitsForCustomEvents);
    }

    async removeMediationGroups(adUnit: {
        admobExistingCustomEvents: AdmobCustomEvent[];
        isThirdPartyBidding: boolean;
        adType: AdType;
        code: string;
        customEvents: any[];
        format: Format;
        internalAdmobAdUnitId: string;
        name: string;
        ecpmFloor: number;
        adUnitId: string
    }) {
        if (adUnit.customEvents.length > 0) {
            for (const itemEvents of adUnit.customEvents) {
                if (adUnit.admobExistingCustomEvents.length) {
                    const createdEvents = adUnit.admobExistingCustomEvents.filter(e => e.label === itemEvents.label);

                    for (let createdEvent of createdEvents) {
                        if (createdEvent.params.some(cr => cr.key === 'class_name' && cr.value !== itemEvents.className)) {
                            const groupIdx = this.createdGroupList['1'].findIndex(group => group['2'] === adUnit.name);
                            if (groupIdx !== -1) {
                                await this.removeMediationGroup([this.createdGroupList['1'][groupIdx]['1']]);
                                this.createdGroupList['1'].splice(groupIdx, 1);
                            }
                        }
                    }
                }
            }
        }
    }

    async createGroups(app, adUnitsForCustomEvents) {
        for (const adUnit of adUnitsForCustomEvents) {
            if (adUnit.customEvents.length) {
                let adMobMediationGroup = this.createdGroupList[1].find(e => e['2'] === adUnit.name);

                if (!adMobMediationGroup) {
                    let resp = await this.createMediationGroup(app, adUnit);
                    adMobMediationGroup = resp['1'];

                    if (!resp['1']) {
                        return;
                    }
                }

                if (adMobMediationGroup) {
                    let mediationGroupId = adMobMediationGroup['1'];
                    let customEventsListOfMediationGroup = await this.getCustomEventsListInMediationGroup(mediationGroupId);

                    if (customEventsListOfMediationGroup['1']['5'].length < adUnit.customEvents.length) {
                        await this.updateMediationGroup(app, adUnit, customEventsListOfMediationGroup['1']);
                        this.logger.info(`Update list of events in the mediation group. Group name is ${adUnit.name}...`);
                    }
                }
            }
        }
    }

    slicingListCustomEvents(array: any[]): any[] {
        let size = 37;
        let subarray = [];
        for (let i = 0; i < Math.ceil(array.length / size); i++) {
            subarray[i] = array.slice((i * size), (i * size) + size);
        }
        return subarray;
    }

    adUnitsForCustomEvents(app: AppodealAppToSync): Array<AppodealAdUnit & Record<string, any>> {
        return app.appodealAdUnits.filter(u => u.customEvents).map((adUnit) => {
            return {
                ...adUnit,
                isDeleted: false,
                platform: CustomEventPlatform[app.platform],
            } as (AppodealAdUnit & Record<string, any>);
        });
    }

    async getCreatedAdUnitsList(admobAppIds: string[]): Promise<any> {
        try {
            return await this.adMobApi.postRaw('AdUnitService', 'List', <UpdateRequest>{
                1: admobAppIds,
            });
        } catch (e) {
            this.logger.error('Failed to getCreatedAdUnitsList ', e);
        }
    }

    async getCreatedBiddingAdUnits(admobAppId: string): Promise<any[]> {
        try {
            if (!admobAppId) {
                return;
            }
            return await this.adMobApi.postRaw('AdUnitService', 'ListGoogleBiddingAdUnits', <UpdateRequest>{
                1: admobAppId,
            }).then(r => r[1]);
        } catch (e) {
            this.logger.error('Failed to getCreatedBiddingAdUnits ', e);
        }
    }

    async getCreatedMediationGroup() {
        try {
            this.logger.info(`Getting mediation groups...`);
            return await this.customEventApi.postRaw(
                'mediationGroup',
                'List',
                {},
            );
        } catch (e) {
            this.logger.error('Failed to getCreatedMediationGroup ', e);
        }
    }

    async getCustomEventsListInMediationGroup(id: string) {
        try {
            this.logger.info(`Getting a list of custom events in mediation group...`);
            return await this.customEventApi.postRaw(
                'mediationGroup',
                'Get',
                {"1": id, "2":false}
            )
        } catch (e) {
            this.logger.error('Failed to getCustomEventsListInMediationGroup ', e);
        }
    }

    async removeMediationGroup(ids: string[]) {
        try {
            this.logger.info(`Getting mediation groups for removal...`);
            return await this.customEventApi.postRaw(
                'mediationGroup',
                'BulkStatusChange',
                {"1": ids, "2": 3}
            )
        } catch (e) {
            this.logger.error('Failed to removeMediationGroup ', e);
        }
    }

    async getCustomEventsList() {
        try {
            this.logger.info(`Getting a list of custom events`);
            return await this.customEventApi.postRaw(
                'mediationAllocation',
                'List',
                {},
            );
        } catch (e) {
            this.logger.error('Failed to getCustomEventsList ', e);
        }
    }

    async createCustomEvents(adUnit: {
        admobExistingCustomEvents: AdmobCustomEvent[];
        isThirdPartyBidding: boolean;
        adType: AdType;
        code: string;
        customEvents: any[];
        format: Format;
        internalAdmobAdUnitId: string;
        name: string;
        ecpmFloor: number;
        adUnitId: string
    }) {
        try {
            this.logger.info(`Creating a customEvent named ${adUnit.name}`);
            let payload = this.customEventPayload(adUnit);
            if (!payload.length) {
                return;
            }

            return await this.customEventApi.postRaw(
                'mediationAllocation',
                'V2Update',
                {
                    '1': payload,
                    '2': [],
                },
            );
        } catch (e) {
            this.logger.error('Failed to createCustomEvents ', e);
        }
    }

    async createMediationGroup(app, adUnit) {
        try {
            this.logger.info(`Creating of a mediation group named ${adUnit.name}`);
            return await this.customEventApi.postRaw(
                'mediationGroup',
                'V2Create',
                this.createV2Param(app, adUnit),
            );
        } catch (e) {
            this.logger.error('Failed to createMediationGroup ', e);
        }
    }

    async updateMediationGroup(app, adUnit, responseV2Params) {
        try {
            this.logger.info(`Updating of a mediation group ${adUnit.name}`);
            return await this.customEventApi.postRaw(
                'mediationGroup',
                'V2Update',
                this.createV2UpdateParam(app, adUnit, responseV2Params),
            );
        } catch (e) {
            this.logger.error('Failed to updateMediationGroup ', e);
        }
    }

    createV2Param(app: AppodealApp, adUnit: any) {
        return {
            "1": adUnit.name,
            "2": 1,
            "3": {
                "1": PlatformGroup[app.platform],
                "2": this.getAdUnitType(adUnit.adType),
                "3": [adUnit.adUnitId],
                "6": 1
            },
            "4": [
                {
                    "2": "1",
                    "3": 1,
                    "4": 1,
                    "5": {"1": "10000", "2": "USD"},
                    "6": false,
                    "9": "AdMob+Network",
                    "11": 1,
                    "14": "2"
                },
            ],
        };
    }

    // save response v2Param
    createV2UpdateParam(app: AppodealApp, adUnit: any, responseV2Param) {
        let map = new Map();
        responseV2Param['5'].forEach(e => map.set(e['9'], e));

        adUnit.customEvents.forEach(event => {
            if (!map.has(event.label)) {
                map.set(event.label, {
                    "2": "7",
                    "3": 1,
                    "4": 2,
                    "5": {"1": Math.round(parseFloat(event.price) * 1000000).toString(10), "2": "USD"},
                    "7": [{
                        "1": adUnit.adUnitId,
                        "2": {
                            "1": [
                                {"1": "class_name", "2": event.className},
                                {"1": "parameter", "2": event.params},
                                {"1": "label", "2": event.label}
                            ]
                        }
                    }],
                    "9": event.label,
                    "11": Boolean(event.removeEvent) ? 3 : 1,
                    "13": [event.eventId],
                    "14": adUnit.platform,
                })
            }
        });

        return {
            "1": {
                ...responseV2Param,
                "5": [...map.values()],
            }
        }
    }

    prepareAdUnitForCreateGroup(resp, adUnit) {
        if (!resp || !resp[1]) {
            return;
        }
        resp[1].forEach(createdEvent => {
            adUnit.customEvents.forEach(event => {
                if (createdEvent['15'] !== event.label) {
                    return;
                }

                if (event['eventId']) {
                    return;
                }

                event['eventId'] = createdEvent['1'];
                event['removeId'] = createdEvent['11'];
            });
        });
    }

    customEventPayload(adUnit: {
        admobExistingCustomEvents: AdmobCustomEvent[];
        isThirdPartyBidding: boolean;
        adType: AdType;
        code: string;
        customEvents: any[];
        format: Format;
        internalAdmobAdUnitId: string;
        name: string;
        ecpmFloor: number;
        adUnitId: string
    }): any[] {

        const eventTranslator = <AdmobCustomEventTranslator>getTranslator(AdmobCustomEventTranslator);

        return adUnit.customEvents.map(apdEvent => {
            // if no events created yet. create set of new events
            if (!adUnit.admobExistingCustomEvents.length) {
                return this.buildCustomEventsList(adUnit, apdEvent);
            }

            const matchedExistingAdmobEvents = adUnit.admobExistingCustomEvents.filter(e => e.label === apdEvent.label);


            // if this event has not been created - create new
            if (!matchedExistingAdmobEvents.length) {
                return this.buildCustomEventsList(adUnit, apdEvent);
            }

            // otherwise, update all events which
            // match label
            // and do not match classname
            return matchedExistingAdmobEvents.map(ee => {
                if (ee.params.some(cr => cr.key === 'class_name' && cr.value !== apdEvent.className)) {
                    apdEvent['eventId'] = ee.eventId;
                    apdEvent['removeId'] = ee['11'];
                    apdEvent['removeEvent'] = true;

                    return eventTranslator.encode({
                        ...ee,
                        params: [
                            {key: 'class_name', value: apdEvent.className},
                            {key: 'parameter', value: apdEvent.params},
                            {key: 'label', value: apdEvent.label},
                        ],
                    });
                }


                apdEvent['eventId'] = ee.eventId;
                apdEvent['removeId'] = ee['11'];
                apdEvent['removeEvent'] = false;

                return null;
            })[0];
        }).filter(Boolean);
    }

    buildCustomEventsList(adUnit, event): any {
        this.logger.info(`Create a customEvent named ${event.label}`);
        return {
            "1": '-1',
            "2": true,
            "3": "7",
            "4": [
                {"1": "class_name", "2": event.className},
                {"1": "parameter", "2": event.params},
                {"1": "label", "2": event.label}
            ],
            "10": 1,
            "12": adUnit.adUnitId,
            "15": event.label,
            "16": adUnit.platform
        }
    }

    async* syncAdUnits(app: AppodealAppToSync, adMobApp: AdMobApp) {
        const createdBiddingAdUnits = await this.getCreatedBiddingAdUnits(adMobApp.appId);
        if (createdBiddingAdUnits.length) {
            app.adUnitTemplatesToCreate.forEach((uTemplate, uName) => {
                if (createdBiddingAdUnits.some(unit => unit[3] === uTemplate.name)) {
                    app.adUnitTemplatesToCreate.delete(uName);
                }
            });
        }

        const templatesToCreate = app.adUnitTemplatesToCreate;
        const {adUnitsToDelete, appodealAdUnits, oldGoodAdUnits} = app;

        this.emitProgress();
        this.logger.info(`AdUnits to create ${templatesToCreate.size}. AdUnit to Delete ${adUnitsToDelete.length}. Unchanged AdUnits ${appodealAdUnits.length}`);

        for (const adUnitTemplate of templatesToCreate.values()) {
            app.subProgressCurrent++;
            this.emitProgress();
            if (this.skipNativeAdUnits && adUnitTemplate.__metadata.adType === AdType.NATIVE) {
                this.logger.info(`Creating Native AdUnit is skipped. ${adUnitTemplate.name}`);
                continue;
            }
            const newAdUnit = await this.createAdMobAdUnit({
                ...adUnitTemplate,
                appId: adMobApp.appId,
                googleOptimizedRefreshRate: adUnitTemplate.__metadata.adType === AdType.BANNER ?
                    false :
                    adUnitTemplate.googleOptimizedRefreshRate,
            }).catch(e => {
                this.logger.info(`Failed to create AdUnit`);
                this.logger.info(e);
                if (adUnitTemplate.__metadata.adType === AdType.NATIVE) {
                    this.skipNativeAdUnits = true;
                    this.logger.info(`Error while creating Native AdUnit. Skip creating Native AdUnits.`);
                    this.logger.info(`Creating Native AdUnit is skipped. ${adUnitTemplate.name}`);
                    // user may be forbidden to create native adunits but have native adunit at appodeal.
                    // we should emit error & continue sync other adunits
                    this.emitError(e);
                    return null;
                }
                throw e;
            });
            if (newAdUnit) {
                this.context.addAdMobAdUnit(newAdUnit);
                this.stats.appUpdated(app);
                appodealAdUnits.push(this.convertToAppodealAdUnit(newAdUnit, adUnitTemplate));
                yield `AdUnit Created ${this.adUnitCode(newAdUnit)} ${adUnitTemplate.name}`;
            }
        }

        // delete bad AdUnits
        if (adUnitsToDelete.length) {
            // await this.deleteAdMobAdUnits(adUnitsToDelete);
            this.context.removeAdMobAdUnits(adUnitsToDelete);
            yield `Bad AdUnits (${adUnitsToDelete}) was deleted`;
        }

        // rename adUnits if needed
        for (let adMobAdUnit of oldGoodAdUnits) {
            if (adMobAdUnit.name.substr(0, this.adUnitNamePrefix.length) !== this.adUnitNamePrefix) {
                app.subProgressCurrent++;
                this.emitProgress();
                const oldName = adMobAdUnit.name;
                adMobAdUnit = await this.updateAdMobAdUnitName(adMobAdUnit, this.patchNamePrefix(adMobAdUnit.name));
                this.context.addAdMobAdUnit(adMobAdUnit);
                this.stats.appUpdated(app);
                yield `AdUnit Name prefix updated ${this.adUnitCode(adMobAdUnit)} from ${oldName} to ${adMobAdUnit.name}`;
            }

            // Set Automatic refresh: disable for banner and mrec adUnits
            const isBanner = adMobAdUnit.name.split('/').find(n => {
                const name = n.toUpperCase();
                return name === AdType.BANNER || name === AdType.MREC;
            });
            if (isBanner && (adMobAdUnit.googleOptimizedRefreshRate === true || adMobAdUnit.refreshPeriodSeconds)) {
                app.subProgressCurrent++;
                delete adMobAdUnit.refreshPeriodSeconds;
                adMobAdUnit = await this.updateAdMobAdUnitAutomaticRefresh({
                    ...adMobAdUnit,
                    googleOptimizedRefreshRate: false,
                });
                this.context.addAdMobAdUnit(adMobAdUnit);
                this.stats.appUpdated(app);
                yield `The 'Automatic Update' field in AdUnit ${this.adUnitCode(adMobAdUnit)} has been changed to 'disabled'`;
            }
        }

        return appodealAdUnits;
    }

    convertToAppodealAdUnit(adMobAdUnit: AdMobAdUnit, template: AdUnitTemplate): AppodealAdUnit {
        return {
            isThirdPartyBidding: template.isThirdPartyBidding,
            code: this.adUnitCode(adMobAdUnit),
            internalAdmobAdUnitId: adMobAdUnit.adUnitId,
            adUnitId: adMobAdUnit.adUnitId,
            name: adMobAdUnit.name,
            ...template.__metadata,
        };
    }

    // filter adUnits which user created manually
    // we should work only adUnits created automatically during sync
    getActiveAdmobAdUnitsCreatedByApp(app: AppodealApp, adMobApp: AdMobApp) {
        return this.filterAppAdUnits(app, this.context.getAdMobAppActiveAdUnits(adMobApp));
    }

    // for backward compablity
    // convert old name generated by plugin
    // from
    // "Appodeal/157197/interstitial/image_and_text/25"
    // to
    // "Appodeal/157197/interstitial/image_and_text/25.00"

    static normalizeAdmobAdUnitName(adUnitName: string) {

        if (/\/image$/.test(adUnitName)) {
            return adUnitName.replace(/\/(image)$/, '/image_and_text');
        }

        if (/\/\d+\.\d$/.test(adUnitName)) {
            return `${adUnitName}0`;
        }

        if (!/\/\d+$/.test(adUnitName)) {
            // do nothing with default adunit name
            return adUnitName;
        }

        if (/\/\d+\.\d\d$/.test(adUnitName)) {
            // it's already new format
            return adUnitName;
        }

        return `${adUnitName}.00`;
    }


    filterAppAdUnits(app: AppodealApp, adUnits: AdMobAdUnit[]) {
        try {
            const pattern = new RegExp('^' + [
                `(${escapeStringRegexp(defaultAdUnitPrefix)}|${escapeStringRegexp(this.adUnitNamePrefix)})`,
                app.id,
                `(${Object.values(AdType).map((v: string) => v.toLowerCase()).join('|')})`,
                `(${Object.values(Format).map((v: string) => v.toLowerCase()).join('|')})`,
            ].join('\/') + '/?');
            this.logger.info(`[AppAdUnits name pattern] ${pattern.toString()}`);

            return adUnits.filter(adUnit => pattern.test(adUnit.name));
        } catch (e) {
            this.logger.error('Failed to filterAppAdUnits ', e);
        }
    }

    adUnitCode(adUnit: AdMobAdUnit) {
        return `ca-app-${this.adMobAccount.id}/${adUnit.adUnitId}`;
    }

    adUnitName(app: AppodealApp, adType: AdType, format: Format, cpmFloor?: number, customName: string = '') {
        return [
            this.adUnitNamePrefix,
            app.id,
            adType.toLowerCase(),
            format.toLowerCase(),
            cpmFloor ? cpmFloor.toFixed(2) : undefined,
            customName,
        ]
            // to remove empty values
            .filter(v => v)
            .join('/');
    }

    getAdUnitType(adType: AdType) {
        // 0 - banner or mrec, 1 - interstital, 3 - native advanced, 5 - revarded, 8 - rewarded interstitial
        switch (adType) {
            // Mrec & banner have same template
            case AdType.BANNER:
            case AdType.MREC:
                return 0;
            case AdType.INTERSTITIAL:
                return 1;
            case AdType.NATIVE:
                return 3;
            case AdType.REWARDED_VIDEO:
                return 5;
            case AdType.REWARDED_INTERSTITIAL:
                return 8;
            default:
                return null;
        }
    }


    /**
     * Build map of AdUnits which is supposed to be created
     * @param app
     */
    buildAdUnitsSchema(app: AppodealApp): Map<AdUnitTemplateId, AdUnitTemplate> {

        return app.ecpmFloors
            .map(floor => ({floor, template: getAdUnitTemplate(floor.adType)}))
            .filter(({floor, template}) => {
                if (!template) {
                    captureMessage(`Unsupported Ad Type ${floor.adType}`);
                    return false;
                }
                return true;
            })
            .map(({floor, template}, i) => {
                    return [
                        // default adUnit with no ecpm
                        this.buildDefaultAdUnitForMediationGroup(app, floor, template),
                        // AdUnits for sent ecpm Floors
                        ...floor.ecpmFloor.filter(v => v > 0).map(ecpmFloor => ({
                            ...template,
                            name: this.buildAdUnitName(app, floor, ecpmFloor),
                            isThirdPartyBidding: floor.isThirdPartyBidding,
                            __metadata: {
                                adType: floor.adType,
                                ecpmFloor: ecpmFloor,
                                customEvents: floor.customEvents,
                                format: floor.format,
                            },
                            cpmFloorSettings: <CpmFloorSettings>{
                                floorMode: CpmFloorMode.Manual,
                                manual: {
                                    globalFloorValue: {
                                        currencyCode: 'USD',
                                        ecpm: ecpmFloor,
                                    },
                                },
                            },
                        })),
                    ];
                },
            )
            .flat(1)
            .map(template => {
                Object.defineProperty(template, '__metadata', {enumerable: false});
                return template;

            })
            .reduce((map, adUnit) => {
                map.set(Sync.getAdUnitTemplateId(<AdMobAdUnit>adUnit), adUnit);
                return map;
            }, new Map());
    }

    buildAdUnitName(app, floor, ecpmFloor = null): string {
        switch (floor.isThirdPartyBidding) {
        case true:
            return this.adUnitName(app, floor.adType, floor.format, ecpmFloor, 'partner_bidding');
        case false:
            return this.adUnitName(app, floor.adType, floor.format, ecpmFloor, 'mediation_group');
        default:
            return this.adUnitName(app, floor.adType, floor.format, ecpmFloor);
        }
    }

    // build options to create a default ad unit to add to mediation group or options without ecpm
    buildDefaultAdUnitForMediationGroup(app, floor, template) {
        let adUnitParams = {
            ...template,
            __metadata: {
                adType: floor.adType,
                ecpmFloor: 0,
                customEvents: floor.customEvents,
                format: floor.format,
            },
            name: this.buildAdUnitName(app, floor),
            isThirdPartyBidding: floor.isThirdPartyBidding,
        };

        return floor.isThirdPartyBidding === false ? {
            ...adUnitParams,
            googleOptimizedRefreshRate: true,
            cpmFloorSettings: {
                floorMode: CpmFloorMode.OptimizedByGoogle,
                optimized: 3,
            },
        } : adUnitParams;
    }


    /**
     * build Template ID from which adUnit is created
     *
     *  user can modify adunit attributes manually after it created
     *  that is why we match adunit only by AdFormat which can not be changed and its name
     * @param adUnit
     */
    static getAdUnitTemplateId(adUnit: AdMobAdUnit): AdUnitTemplateId {

        return stringify([
            // extract prefix. it has no power here
            Sync.normalizeAdmobAdUnitName(adUnit.name).split('/').slice(1).join('/'),
            adUnit.adFormat,
        ]);
    }

    patchNamePrefix(name: string): string {
        const chunks = name.split('/');
        chunks[0] = this.adUnitNamePrefix;
        return chunks.join('/');
    }

    get adUnitNamePrefix() {
        return this.appodealAccount.adUnitNamePrefix || defaultAdUnitPrefix;
    }

    validateAdmobApp(app: AppodealApp, adMobApp: AdMobApp) {
        if (!adMobApp) {
            return null;
        }

        const adMobPlatform = Sync.toAdMobPlatform(app);

        if (adMobApp.hidden) {
            this.logger.info('[FindAdMobApp] App become hidden');
            return null;
        }

        if (adMobApp.platform !== adMobPlatform) {
            this.logger.info(`[FindAdMobApp] Wrong Platform ! Actual Platform [${adMobPlatform}] ${app.platform}. Admob App Platform [${adMobApp.platform}]`);
            return null;
        }

        if (adMobApp.applicationPackageName && app.bundleId && adMobApp.applicationPackageName !== app.bundleId) {
            this.logger.info(`[FindAdMobApp] Wrong bundle ID. Appodeal bundleId '${app.bundleId}'. Admob applicationPackageName '${adMobApp.applicationPackageName}' `);
            return null;
        }
        return adMobApp;
    }

    appNameRegExp(app: AppodealApp) {
        return new RegExp(`^(${escapeStringRegexp(defaultAdUnitPrefix)}|${escapeStringRegexp(this.adUnitNamePrefix)})/${app.id}/.*$`);
    }

    findAdMobApp(app: AppodealApp, apps: AdMobApp[]): AdMobApp {
        try {
            const adMobPlatform = Sync.toAdMobPlatform(app);

            let adMobApp = app.platform !== AppodealPlatform.AMAZON && app.bundleId
                ? apps.find(adMobApp => adMobApp.platform === adMobPlatform && adMobApp.applicationPackageName === app.bundleId)
                : null;

            if (adMobApp) {
                this.logger.info('[FindAdMobApp] Found by bundle ID');
                return adMobApp;
            }

            if (app.admobAppId) {
                adMobApp = apps.find(adMobApp => adMobApp.appId === app.admobAppId);
                adMobApp = this.validateAdmobApp(app, adMobApp);

                if (adMobApp) {
                    this.logger.info('[FindAdMobApp] Found by adMobAppId');
                    return adMobApp;
                } else {
                    this.logger.info('[FindAdMobApp] has INVALID adMobAppId');
                }
            }

            const namePattern = this.appNameRegExp(app);
            adMobApp = apps.find(adMobApp => !adMobApp.hidden && adMobApp.platform === adMobPlatform && namePattern.test(adMobApp.name));
            if (adMobApp) {
                this.logger.info('[FindAdMobApp] Found by NAME pattern');
                return adMobApp;
            }

            this.logger.info('[FindAdMobApp] Failed to find App');
            return null;
        } catch (e) {
            this.logger.error('Failed to findAdMobApp ', e);
        }
    }


    async createAdMobApp(app: AppodealApp, admobAccountId: string): Promise<AdMobApp> {
        try {
            const adMobApp: Partial<AdMobApp> = {
                name: [this.adUnitNamePrefix, app.id, app.name].join('/').substr(0, MAX_APP_NAME_LENGTH),
                platform: Sync.toAdMobPlatform(app),
                userMetricsStatus: UserMetricsStatus.DISABLED,
            };
            return this.adMobApi.postRaw('AppService', 'Create', getTranslator(AppCreateRequestTranslator).encode({
                app: adMobApp,
                requestHeader: {
                    context: {
                        host: Host.ADMOB,
                        publisherCode: admobAccountId,
                    },
                },
            } as AppCreateRequest))
                .then(res => (getTranslator(AppCreateResponseTranslator).decode(res) as AppCreateResponse).app);
        } catch (e) {
            this.logger.error('Failed to createAdMobApp ', e);
        }
    }

    async updateAdMobAppName(adMobApp: AdMobApp, newName: string): Promise<AdMobApp> {
        try {
            adMobApp.name = newName;
            return await this.adMobApi.postRaw('AppService', 'Update', <UpdateRequest>{
                1: getTranslator(AppTranslator).encode(adMobApp),
                2: {1: ['name']},
            }).then((res: UpdateResponse) => getTranslator(AppTranslator).decode(res[1]));
        } catch (e) {
            this.logger.error('Failed to updateAdMobAppName ', e);
        }
    }


    async showAdMobApp(adMobApp: AdMobApp): Promise<AdMobApp> {
        try {
            return this.adMobApi.postRaw(
                'AppService',
                'Update',
                {
                    "1": {"1": {"1": 1, "3": `${this.adMobAccount.id}`}},
                    "2": [{"1": {"19": false, "36": adMobApp['36']}, "2": ["hidden"]}]
                })
                .then(() => ({...adMobApp, hidden: false}));
        } catch (e) {
            this.logger.error('Failed to showAdMobApp ', e);
        }
    }

    async hideAdMobApp(adMobApp: AdMobApp): Promise<AdMobApp> {
        try {
            return this.adMobApi.postRaw(
                'AppService',
                'Update',
                {
                    "1": {"1": {"1": 1, "3": `${this.adMobAccount.id}`}},
                    "2": [{"1": {"19": true, "36": adMobApp['36']}, "2": ["hidden"]}]
                })
                .then(() => ({...adMobApp, hidden: true}));
        } catch (e) {
            this.logger.error('Failed to hideAdMobApp ', e);
        }
    }

    async linkAppWithStore(app: AppodealApp, adMobApp: AdMobApp): Promise<AdMobApp> {

        try {
            interface SearchAppRequest {
                1: {
                1: {
                    1: number,
                    3: string, // 'pub-5724626354699096', // publisher id
                    5: { 4: boolean, 5: boolean, 6: boolean, 7: boolean, 10: boolean, 11: boolean, 12: boolean },
                },
            },
                2: string, // 'search name'
                3: number,
                4: number, // pagination
            5: AdMobPlatform, // 2, // platform
            }

        interface SearchResponse {
            2: number; // number of results
            3: SearchAppResponse[]; // apps ;
        }

            interface SearchAppResponse {
                2: string, // app name
            3: number, // 1, // platform
            4: string, // store id
            5: string, // developer name
            6: number, // 1, // ???
            7: string, // icon
            8: {
                2: string // currency
            },
            10: string, // store link
            12: number, // Rating
            13: number, // position in store
            22: string, // applicationPackageName
            32: [
                {
                    2: number, // 1 // platform 1-iOs; 2-Android
                }
            ]
            }

            const searchAppResponse: AdMobApp[] = await this.adMobApi.postRaw('AppService', 'Search', <SearchAppRequest>{
                '1': {
                '1': {
                    '1': 1,
                    '3': this.adMobAccount.id,
                    '5': {'4': false, '5': false, '6': false, '7': true, '10': false, '11': false, '12': false},
                },
            },
            '2': String(app.bundleId).substr(0, 79),
                '3': 0,
                '4': 10,
            '5': Sync.toAdMobPlatform(app),
            }).then((response: SearchResponse) => Boolean(response[2]) ? response[3].map(getTranslator(AppTranslator).decode) : []);

        const publishedApp = searchAppResponse.find(publishedApp => {
            return app.platform === AppodealPlatform.IOS ?
                publishedApp.applicationPackageName === app.bundleId :
                publishedApp.applicationStoreId === app.bundleId;
        });
        if (publishedApp) {
            this.logger.info(`App found in store`);
            this.stats.appUpdated(app);
            adMobApp = {...adMobApp, ...publishedApp};

            let copyAdmobApp = {
                name: adMobApp.name,
                applicationStoreId: adMobApp.applicationStoreId,
                platformType: adMobApp.platformType, // more options {"2":14},{"2":15},{"2":16},{"2":17},{'2': 18}
                    publisherId: '',
            };

            let firstParamPayload = {
                '1': {
                    '1': 1,
                    '3': this.adMobAccount.id,
                        '5': {'4': false, '5': false, '6': false, '7': true, '10': false, '11': false, '12': false},
                },
            }


            // getting all list for build 'adMobAppInfo' and Update app
            await this.adMobApi.postRaw(
                'AppService',
                'List',
                {'1': firstParamPayload, '2': 1},
            ).then((res: UpdateResponse) => {
                if (!res[2]) {
                    return;
                }

                // find app and take the publisher ID
                res[2].find(app => {
                    if (app['1'] === adMobApp.appId) {
                        copyAdmobApp.publisherId = app['36'];
                    }
                });
            });

            let adMobAppInfo = getTranslator(AppTranslator).encode(copyAdmobApp);

            // build correct type. Object ---> Array
            adMobAppInfo['32'] = Object.values(adMobAppInfo['32']);


            return await this.adMobApi.postRaw(
                'AppService',
                'Update',
                {
                    '1': firstParamPayload,
                    '2': [
                        {
                            '1': adMobAppInfo,
                            '2': ['stores', 'application_store_id', 'name'],
                        },
                        ],
                    },
                ).then((res: UpdateResponse) => getTranslator(AppTranslator).decode(res[2][0]));
            }
            this.logger.info(`App NOT found in store`);
            return adMobApp;
        } catch (e) {
            this.logger.error('Failed to linkAppWithStore ', e);
        }
    }

    async createAdMobAdUnit(adUnit: Partial<AdMobAdUnit>): Promise<AdMobAdUnit> {
        try {
            return this.adMobApi.post(
                'AdUnitService',
                'Create',
                {"1": getTranslator(AdUnitTranslator).encode(adUnit)})
                .then(res => getTranslator(AdUnitTranslator).decode(res));
        } catch (e) {
            this.logger.error('Failed to createAdMobAdUnit ', e);
        }
    }

    async updateAdMobAdUnitName(adMobAdUnit: AdMobAdUnit, newName: string): Promise<AdMobAdUnit> {
        try {
            adMobAdUnit.name = newName;
            return await this.adMobApi.postRaw('AdUnitService', 'Update', <UpdateRequest>{
                1: getTranslator(AdUnitTranslator).encode(adMobAdUnit),
                2: {1: ['name']},
            }).then((res: UpdateResponse) => getTranslator(AdUnitTranslator).decode(res[1]));
        } catch (e) {
            this.logger.error('Failed to updateAdMobAdUnitName ', e);
        }
    }

    async updateAdMobAdUnitAutomaticRefresh(adMobAdUnit: AdMobAdUnit): Promise<AdMobAdUnit> {
        try {
            return await this.adMobApi.postRaw('AdUnitService', 'Update', <UpdateRequest>{
                1: getTranslator(AdUnitTranslator).encode(adMobAdUnit),
                2: {1: ['refresh_period_seconds', 'google_optimized_refresh_rate']},
            })
                .then((res: UpdateResponse) => getTranslator(AdUnitTranslator).decode(res[1]))
                .catch(error => this.logger.error('Failed to AdUnitService ', error));
        } catch (e) {
            this.logger.error('Failed to updateAdMobAdUnitAutomaticRefresh ', e);
        }
    }

    async deleteAdMobAdUnits(ids: string[]) {
        try {
            return this.adMobApi.post('AdUnitService', 'BulkRemove', {"1": ids, "2": 1});
        } catch (e) {
            this.logger.error('Failed to deleteAdMobAdUnits ', e);
        }
    }

    async deleteAdMobAdUnitsBidding(ids: string[]) {
        try {
            return this.adMobApi.post('AdUnitService', 'BulkRemove', {"1": ids, "2": 2});
        } catch (e) {
            this.logger.error('Failed to deleteAdMobAdUnitsBidding ', e);
        }
    }


}
