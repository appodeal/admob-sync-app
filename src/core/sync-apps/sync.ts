import {captureMessage} from '@sentry/core';
import {AdmobApiService, RefreshXsrfTokenError, UpdateRequest, UpdateResponse} from 'core/admob-api/admob.api';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {
    AdType,
    AppodealAdUnit,
    AppodealApp,
    AppodealPlatform,
    Format
} from 'core/appdeal-api/interfaces/appodeal-app.interface';
import {getAdUnitTemplate} from 'core/sync-apps/ad-unit-templates';
import {SyncStats} from 'core/sync-apps/sync-stats';
import stringify from 'json-stable-stringify';
import {retryProxy} from 'lib/retry';
import {
    AppCreateRequestTranslator,
    AppCreateResponseTranslator,
    AppTranslator
} from 'lib/translators/admob-app.translator';
import {AdMobPlatform} from 'lib/translators/admob.constants';
import {AdUnitTranslator} from 'lib/translators/admop-ad-unit.translator';
import {
    AdMobAdFormat,
    AdMobAdUnit,
    CpmFloorMode,
    CpmFloorSettings
} from 'lib/translators/interfaces/admob-ad-unit.interface';
import {
    AdMobApp,
    AppCreateRequest,
    AppCreateResponse,
    Host,
    UserMetricsStatus
} from 'lib/translators/interfaces/admob-app.interface';
import {getTranslator} from 'lib/translators/translator.helpers';
import uuid from 'uuid';
import {decodeOctString} from '../../lib/oct-decode';
import {AdMobAccount} from '../appdeal-api/interfaces/admob-account.interface';
import {AppodealAccount} from '../appdeal-api/interfaces/appodeal.account.interface';
import {NoConnectionError} from '../error-factory/errors/network/no-connection-error';
import {UnavailableEndpointError} from '../error-factory/errors/network/unavailable-endpoint-error';
import {SyncContext} from './sync-context';
import {SyncEventEmitter} from './sync-event.emitter';
import {SyncRunner} from './sync-runner';
import {SyncErrorEvent, SyncEvent, SyncEventsTypes, SyncReportProgressEvent, SyncStopEvent} from './sync.events';
import escapeStringRegexp = require('escape-string-regexp');
import {CustomEventApiService} from "core/admob-api/custom-event.api";


const isObject = (v) => v !== null && typeof v === 'object';

type AdUnitTemplateId = string;
type AdUnitId = string;

interface AppodealAppToSync extends AppodealApp {
    admobApp: AdMobApp
    subProgressCurrent: number
    subProgressTotal: number
    adUnitTemplatesToCreate: Map<AdUnitTemplateId, AdUnitTemplate>
    adUnitsToDelete: AdUnitId[]
    appodealAdUnits: any[]
    oldGoodAdUnits: AdMobAdUnit[]
    adUnitsToUpdateName: AdMobAdUnit[]
    synced: boolean
}

const MAX_APP_NAME_LENGTH = 80;

interface AdUnitTemplate extends Partial<AdMobAdUnit> {
    __metadata: {
        ecpmFloor: number;
        adType: AdType;
        format: Format;
    }
}

enum CustomEventPlatform {
    'ANDROID' = '12',
    'IOS' = '13'
}

enum PlatformGroup {
    'IOS' = 1,
    'ANDROID' = 2,
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
        public readonly runner: SyncRunner
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
        this.stats.end();
        this.emitStop();
        this.appodealApi.reportSyncEnd(this.id);
    }

    emit(event: SyncEvent | SyncEventsTypes) {
        if (isObject(event)) {
            (<SyncEvent>event).id = this.id;
            (<SyncEvent>event).accountId = this.adMobAccount.id;
            return this.events.emit(<SyncEvent>event);
        }
        return this.events.emit({type: <SyncEventsTypes>event, id: this.id, accountId: this.adMobAccount.id});
    }

    emitProgress() {
        const progress: Partial<SyncReportProgressEvent> = {};
        progress.synced = this.syncedAppCount;
        progress.failed = this.failedAppCount;
        progress.total = this.apps.length;

        const currentProgress = this.apps.reduce(
            (acc, app) => acc + (app.synced ? 2 + app.subProgressTotal : Math.min(app.subProgressCurrent, app.subProgressTotal)),
            0
        );

        const totalProgress = this.apps.reduce((acc, app) => acc + 2 + app.subProgressTotal, 0);

        progress.percent = Math.round(currentProgress / totalProgress * 100);
        progress.type = SyncEventsTypes.ReportProgress;
        return this.emit(<SyncReportProgressEvent>progress);
    }

    emitError(error: Error) {
        this.hasErrors = true;
        return this.emit(<SyncErrorEvent>{
            type: SyncEventsTypes.Error,
            error
        });
    }

    emitStop () {
        return this.emit(<SyncStopEvent>{type: SyncEventsTypes.Stopped, terminated: this.terminated, hasErrors: this.hasErrors});
    }

    async* doSync() {
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
            apps: this.ejectAppsAppsFromAdmob(pageBody),
            adUnits: this.ejectAdUnitsFromAdmob(pageBody)
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

    ejectAppsAppsFromAdmob(body: string) {

        const mathResult = body.match(/var apd = '(?<appsJson>[^\']*)';/);

        if (!mathResult || !mathResult.groups || !mathResult.groups.appsJson) {
            // may be user's action required
            throw new Error('Apps not found');
        }
        let json;
        try {
            json = decodeOctString(mathResult.groups.appsJson);
            const apps = <any[]>JSON.parse(json)[1] || [];
            return apps.map<AdMobApp>(getTranslator(AppTranslator).decode);
        } catch (e) {
            console.log('appsJson', json, body);
            console.error(e);
            throw e;
        }
    }

    ejectAdUnitsFromAdmob(body: string) {
        const mathResult = body.match(/var aupd = '(?<appsJson>[^\']*)';/);

        if (!mathResult || !mathResult.groups || !mathResult.groups.appsJson) {
            // may be user's action required
            throw new Error('AdUnits not found');
        }
        let json;
        try {
            json = decodeOctString(mathResult.groups.appsJson);
            const adUnits = <any[]>JSON.parse(json)[1] || [];
            return adUnits.map<AdMobAdUnit>(getTranslator(AdUnitTranslator).decode);
        } catch (e) {
            console.log('appsJson', json, body);
            console.error(e);
            throw e;
        }
    }

    prepareApps(apps) {

        const prepareAppDataToSync = (app: AppodealAppToSync) => {

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

            if (adMobApp) {
                app.adUnitTemplatesToCreate = this.buildAdUnitsSchema(app, adMobApp);
            }


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
                adMobAdUnit => adMobAdUnit.name.substr(0, this.adUnitNamePrefix.length) !== this.adUnitNamePrefix
            );
            return app;
        };

        const calculateTotal = app => {
            app.subProgressTotal += app.adUnitTemplatesToCreate.size + app.adUnitsToUpdateName.length;

            return app;
        };

        return apps
            .map(prepareAppDataToSync)
            .map(calculateTotal);
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
                this.logger.error(e);
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

        const adUnitsToDelete = this.getActiveAdmobAdUnitsCreatedByApp(app, adMobApp).map(adUnit => adUnit.adUnitId);
        if (adUnitsToDelete.length) {
            await this.deleteAdMobAdUnits(adUnitsToDelete);
            this.context.removeAdMobAdUnits(adUnitsToDelete);
            this.stats.appDeleted(app);
            yield `${adUnitsToDelete.length} adUnits deleted`;
        } else {
            yield `No AdUnits to delete`;
        }


        // in case app has at least one active adUnit it should no be hidden
        if (!adMobApp.hidden && !this.context.getAdMobAppActiveAdUnits(adMobApp).length) {
            yield `Hide App. All its adUnits are archived`;
            adMobApp = await this.hideAdMobApp(adMobApp);
            this.context.updateAdMobApp(adMobApp);
            this.stats.appDeleted(app);
            yield `App Hidden`;
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

        yield* this.syncCustomEvents(app, adMobApp);
        yield `CustomEvents actualized`;

        await this.appodealApi.reportAppSynced(app, this.id, this.adMobAccount.id, adMobApp, actualAdUnits);
        yield `End Sync  App [${app.id}] ${app.name}`;
    }

    async* syncCustomEvents(app: AppodealAppToSync, adMobApp: AdMobApp) {
        let adUnitsForCustomEvents = this.adUnitsForCustomEvents(app);
        let createdBiddingAdUnits = await this.getCreatedBiddingAdUnits(app.admobAppId);
        let createdEvents = await this.getCreatedCustomEvents();
        let copyAdUnitsForCustomEvents = [];

        //  create events
        for (const adUnit of adUnitsForCustomEvents) {
            if (!createdBiddingAdUnits[1]) {
                return;
            }
            if (!createdBiddingAdUnits[1].some(unit => unit[1] === adUnit.adUnitId)) {
                let slicedAdUnit = this.sliceCreatedEvents(adUnit, createdEvents);
                copyAdUnitsForCustomEvents.push(slicedAdUnit);

                if (slicedAdUnit.customEvents.length > 0) {
                    try {
                        this.prepareAdUnitForCreateGroup(await this.createCustomEvents(slicedAdUnit), slicedAdUnit);
                    } catch (e) {
                        console.error(e)
                    }
                }
            }
        }

        //  create groups
        for (const adUnit of copyAdUnitsForCustomEvents) {
            if (adUnit.customEvents.length) {
                try {
                    await this.createMediationGroup(app, adUnit);
                } catch (e) {
                    console.error(e)
                }
            }
        }
    }

    sliceCreatedEvents(adUnit, createdEvents) {
        let localAdUnit = JSON.parse(JSON.stringify(adUnit));
        adUnit.customEvents.forEach((event, i) => {
            createdEvents[1].forEach(createdAdUnit => {
                if (!createdAdUnit[5]) {
                    return;
                }

                if (createdAdUnit[2] === adUnit.name && createdAdUnit[5].some(e => e[9] === event.label)) {
                    localAdUnit.customEvents.splice(i, 1);
                }
            });
        });

        return localAdUnit;
    }

    adUnitsForCustomEvents(app: AppodealAppToSync): any[] {
        let adUnitForCustomEventsList: any[] = app.customEventsList;
        return adUnitForCustomEventsList.map(adUnit => {
            return {
                ...adUnit,
                isDeleted: false,
                platform: CustomEventPlatform[app.platform],
            }
        });
    }

    async getCreatedBiddingAdUnits(admobAppId: string): Promise<any> {
        if (!admobAppId) {
            return;
        }
        return await this.adMobApi.postRaw('AdUnitService', 'ListGoogleBiddingAdUnits', <UpdateRequest>{
            1: admobAppId
        });
    }

    async getCreatedCustomEvents() {
        return await this.customEventApi.postRaw(
            'mediationGroup',
            'List',
            {}
        )
    }

    async createCustomEvents(adUnit) {
        return await this.customEventApi.postRaw(
            'mediationAllocation',
            'Update',
            this.adUnitPayload(adUnit)
        );
    }

    async createMediationGroup(app, adUnit) {
        await this.customEventApi.postRaw(
            'mediationGroup',
            'V2Create',
            this.createV2Param(app, adUnit)
        )
    }

    async removeMediationGroup(app, adUnit) {
        await this.customEventApi.postRaw(
            'mediationGroup',
            'BulkStatusChange',
            // this.createV2Param(app, adUnit)
            {
                1: {},
                2: {}
            }
        )
    }

    createV2Param(app: AppodealApp, adUnit: any) {
        const eventIds = new Set();
        let eventsList = adUnit.customEvents.map(event => {
            eventIds.add(event.eventId);
            return {
                "2": "7",
                "3": 1,
                "4": 2,
                "5": {"1": event.price, "2": "USD"},
                "9": event.label,
                "11": 1,
                "13": Array.from(eventIds),  // eventID-s
                "14": adUnit.platform
            }
        })

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
                ...eventsList
            ]
        }
    }

    prepareAdUnitForCreateGroup(resp, adUnit) {
        if (!resp[1]) {
            return;
        }
        resp[1].forEach(createdEvent => {
            adUnit.customEvents.forEach(event => {
                if (createdEvent['15'] !== event.label) {
                    return;
                }

                event['eventId'] = createdEvent['1'];
                event['removeId'] = createdEvent['11'];
                event.price = event.price * 1000000;
            })
        });
    }

    adUnitPayload(adUnit: any) {
        return {
            "1": adUnit.isDeleted ? this.removeCustomEvent(adUnit) : this.createCustomEvent(adUnit),
            "2": []
        }
    }

    createCustomEvent(adUnit): any[] {
        return adUnit.customEvents.map(event => ({
            "1": '-1',
            "2": adUnit.isDeleted,
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
        }))
    }

    removeCustomEvent(adUnit): any[] {
        return adUnit.customEvents.map(event => ({
            "1": adUnit.eventId,
            "2": adUnit.isDeleted,
            "3": "7",
            "4": [
                {"1": "class_name", "2": event.className},
                {"1": "parameter", "2": event.params},
                {"1": "label", "2": event.label}
            ],
            "7": false,
            "9": false,
            "10": 1,
            "11": adUnit.removeId,
            "12": adUnit.adUnitId,
            "14": 7,
            "15": event.label,
            "16": adUnit.platform
        }));
    }

    async* syncAdUnits(app: AppodealAppToSync, adMobApp: AdMobApp) {
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
            const newAdUnit = await this.createAdMobAdUnit({...adUnitTemplate, appId: adMobApp.appId}).catch(e => {
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
            await this.deleteAdMobAdUnits(adUnitsToDelete);
            this.context.removeAdMobAdUnits(adUnitsToDelete);
            yield `Bad AdUnits (${adUnitsToDelete}) was deleted`;
        }

        // rename adunits if needed
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
        }

        return appodealAdUnits;
    }

    convertToAppodealAdUnit(adMobAdUnit: AdMobAdUnit, template: AdUnitTemplate): AppodealAdUnit {
        return {
            isThirdPartyBidding: template.isThirdPartyBidding,
            code: this.adUnitCode(adMobAdUnit),
            ...template.__metadata
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
        const pattern = new RegExp('^' + [
            `(${escapeStringRegexp(defaultAdUnitPrefix)}|${escapeStringRegexp(this.adUnitNamePrefix)})`,
            app.id,
            `(${Object.values(AdType).map((v: string) => v.toLowerCase()).join('|')})`,
            `(${Object.values(Format).map((v: string) => v.toLowerCase()).join('|')})`
        ].join('\/') + '/?');
        this.logger.info(`[AppAdUnits name pattern] ${pattern.toString()}`);

        return adUnits.filter(adUnit => pattern.test(adUnit.name));
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
            customName
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
    buildAdUnitsSchema(app: AppodealApp, adMobApp: AdMobApp): Map<AdUnitTemplateId, AdUnitTemplate> {

        return app.ecpmFloors
            .map(floor => {
                return this.prepareAdUnitTemplate(floor);
            })
            .filter(({floor, template}) => {
                if (!template) {
                    captureMessage(`Unsupported Ad Type ${floor.adType}`);
                    return false;
                }
                return true;
            })
            .map(({floor, template}, i) => {
                    if (floor.customEvents !== null) {
                        const activeAdUnit = this.getActiveAdmobAdUnitsCreatedByApp(app, adMobApp).find(adUnit => adUnit.name === this.buildAdUnitName(app, floor));

                        if (activeAdUnit) {
                            app.customEventsList.push({
                                adType: floor.adType,
                                adUnitId: activeAdUnit.adUnitId,
                                customEvents: floor.customEvents,
                                name: this.buildAdUnitName(app, floor),
                                isThirdPartyBidding: floor.isThirdPartyBidding,
                            });
                        }
                    }
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
                                format: floor.format
                            },
                            cpmFloorSettings: <CpmFloorSettings>{
                                floorMode: CpmFloorMode.Manual,
                                manual: {
                                    globalFloorValue: {
                                        currencyCode: 'USD',
                                        ecpm: ecpmFloor
                                    }
                                }
                            }
                        }))
                    ];
                }
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

    buildAdUnitName (app, floor, ecpmFloor = null): string {
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
    buildDefaultAdUnitForMediationGroup (app, floor, template) {
        let adUnitParams = {
            ...template,
            __metadata: {
                adType: floor.adType,
                ecpmFloor: 0,
                format: floor.format
            },
            name: this.buildAdUnitName(app, floor),
            isThirdPartyBidding: floor.isThirdPartyBidding,
        }

        return floor.isThirdPartyBidding === false ? {
            ...adUnitParams,
            googleOptimizedRefreshRate: true,
            cpmFloorSettings: {
                floorMode: CpmFloorMode.OptimizedByGoogle,
                optimized: 3
            }
        } : adUnitParams
    }

    prepareAdUnitTemplate(floor) {
        if (floor.isThirdPartyBidding) {
            return {
                floor,
                template: {
                    adFormat: AdMobAdFormat.FullScreen,
                    isThirdPartyBidding: false
                },
            };
        }
        return {floor, template: getAdUnitTemplate(floor.adType)};
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
            adUnit.adFormat
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
    }


    async createAdMobApp(app: AppodealApp, admobAccountId: string): Promise<AdMobApp> {

        const adMobApp: Partial<AdMobApp> = {
            name: [this.adUnitNamePrefix, app.id, app.name].join('/').substr(0, MAX_APP_NAME_LENGTH),
            platform: Sync.toAdMobPlatform(app),
            userMetricsStatus: UserMetricsStatus.DISABLED
        };
        return this.adMobApi.postRaw('AppService', 'Create', getTranslator(AppCreateRequestTranslator).encode({
            app: adMobApp,
            requestHeader: {
                context: {
                    host: Host.ADMOB,
                    publisherCode: admobAccountId
                }
            }
        } as AppCreateRequest))
            .then(res => (getTranslator(AppCreateResponseTranslator).decode(res) as AppCreateResponse).app);
    }

    async updateAdMobAppName(adMobApp: AdMobApp, newName: string): Promise<AdMobApp> {
        adMobApp.name = newName;
        return await this.adMobApi.postRaw('AppService', 'Update', <UpdateRequest>{
            1: getTranslator(AppTranslator).encode(adMobApp),
            2: {1: ['name']}
        }).then((res: UpdateResponse) => getTranslator(AppTranslator).decode(res[1]));
    }


    async showAdMobApp(adMobApp: AdMobApp): Promise<AdMobApp> {
        return this.adMobApi.postRaw('AppService', 'BulkUpdateVisibility', {1: [adMobApp.appId], 2: true})
            .then(() => ({...adMobApp, hidden: false}));
    }

    async hideAdMobApp(adMobApp: AdMobApp): Promise<AdMobApp> {
        return this.adMobApi.postRaw('AppService', 'BulkUpdateVisibility', {1: [adMobApp.appId], 2: false})
            .then(() => ({...adMobApp, hidden: true}));
    }

    async linkAppWithStore(app: AppodealApp, adMobApp: AdMobApp): Promise<AdMobApp> {

        interface SearchAppRequest {
            1: string; // query
            2: number; // offset;
            3: number; // limit
            4: AdMobPlatform // "platform"
        }

        interface SearchAppResponse {
            1: number; // number of results
            2: any[]; // apps ;
        }

        const searchAppResponse: AdMobApp[] = await this.adMobApi.postRaw('AppService', 'Search', <SearchAppRequest>{
            1: String(app.bundleId).substr(0, 79),
            2: 0,
            3: 100,
            4: Sync.toAdMobPlatform(app)
        }).then((response: SearchAppResponse) => response[1] ? response[2].map(getTranslator(AppTranslator).decode) : []);

        const publishedApp = searchAppResponse.find(publishedApp => publishedApp.applicationStoreId === app.bundleId);
        if (publishedApp) {
            this.logger.info(`App found in store`);
            this.stats.appUpdated(app);
            adMobApp = {...adMobApp, ...publishedApp};
            let copyAdmobApp = {...adMobApp}
            delete copyAdmobApp.appId;
            return await this.adMobApi.postRaw(
                'AppService',
                'Update',
                {
                    "1": {"1": {"1": 1, "3": this.adMobAccount.id}},
                    "2": [{
                        "1": getTranslator(AppTranslator).encode(copyAdmobApp),
                        "2": ["stores", "application_store_id", "name"]
                    }]
            }
            ).then((res: UpdateResponse) => getTranslator(AppTranslator).decode(res[1]));
        }
        this.logger.info(`App NOT found in store`);
        return adMobApp;
    }

    async createAdMobAdUnit(adUnit: Partial<AdMobAdUnit>): Promise<AdMobAdUnit> {
        return this.adMobApi.post('AdUnitService', 'Create', getTranslator(AdUnitTranslator).encode(adUnit))
            .then(res => getTranslator(AdUnitTranslator).decode(res));
    }

    async updateAdMobAdUnitName(adMobAdUnit: AdMobAdUnit, newName: string): Promise<AdMobAdUnit> {
        adMobAdUnit.name = newName;

        return await this.adMobApi.postRaw('AdUnitService', 'Update', <UpdateRequest>{
            1: getTranslator(AdUnitTranslator).encode(adMobAdUnit),
            2: {1: ['name']}
        }).then((res: UpdateResponse) => getTranslator(AdUnitTranslator).decode(res[1]));
    }

    async deleteAdMobAdUnits(ids: string[]) {
        return this.adMobApi.post('AdUnitService', 'BulkRemove', ids);
    }


}
