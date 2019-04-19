import {captureMessage} from '@sentry/core';
import {AdmobApiService, RefreshXsrfTokenError} from 'core/admob-api/admob.api';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AdType, AppodealAdUnit, AppodealApp, AppodealPlatform, Format} from 'core/appdeal-api/interfaces/appodeal-app.interface';
import {getAdUnitTemplate} from 'core/sync-apps/ad-unit-templates';
import {SyncStats} from 'core/sync-apps/sync-stats';
import {SyncRunner} from 'core/sync-apps/sync.service';
import stringify from 'json-stable-stringify';
import {retry} from 'lib/retry';
import {AppTranslator} from 'lib/translators/admob-app.translator';
import {AdMobPlatform} from 'lib/translators/admob.constants';
import {AdUnitTranslator} from 'lib/translators/admop-ad-unit.translator';
import {AdMobAdUnit, CpmFloorMode, CpmFloorSettings} from 'lib/translators/interfaces/admob-ad-unit.interface';
import {AdMobApp} from 'lib/translators/interfaces/admob-app.interface';
import {getTranslator} from 'lib/translators/translator.helpers';
import uuid from 'uuid';
import {SyncContext} from './sync-context';
import {SyncEventEmitter} from './sync-event.emitter';
import {SyncErrorEvent, SyncEvent, SyncEventsTypes, SyncReportProgressEvent} from './sync.events';


const isObject = (v) => v !== null && typeof v === 'object';

type AdUnitTemplateId = string;
type AdUnitId = string;

const MAX_APP_NAME_LENGTH = 80;

interface AdUnitTemplate extends Partial<AdMobAdUnit> {
    __metadata: {
        ecpmFloor: number;
        adType: AdType;
        format: Format;
    }
}


export class Sync {

    public events = new SyncEventEmitter();

    /**
     * if there is any error during the sync
     */
    public hasErrors = false;
    private terminated = true;


    public readonly stats = new SyncStats(this);

    public context = new SyncContext();

    /**
     * if user have no permissions to create native adunits we should not try do it many times.
     */
    private skipNativeAdUnits = false;

    constructor (
        private adMobApi: AdmobApiService,
        private appodealApi: AppodealApiService,
        public adMobAccount: AdMobAccount,
        private appodealAccountId: string,
        private logger: Partial<Console>,
        // some uniq syncId
        public readonly id: string,
        public readonly runner: SyncRunner
    ) {
        this.id = id || uuid.v4();
    }

    async stop (reason: string) {
        if (this.terminated) {
            this.logger.info(`Sync already stopped. New Stop Reason: ${reason}`);
            return;
        }
        this.terminated = true;
        this.stats.terminated = true;
        this.logger.info(`Stopping Sync Reason: ${reason}`);
    }

    async run () {
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

    finish () {
        this.stats.end();
        this.emit(SyncEventsTypes.Stopped);
        this.appodealApi.reportSyncEnd(this.id);
    }

    emit (event: SyncEvent | SyncEventsTypes) {
        if (isObject(event)) {
            (<SyncEvent>event).id = this.id;
            (<SyncEvent>event).accountId = this.adMobAccount.id;
            return this.events.emit(<SyncEvent>event);
        }
        return this.events.emit({type: <SyncEventsTypes>event, id: this.id, accountId: this.adMobAccount.id});
    }

    emitProgress (progress: Partial<SyncReportProgressEvent>) {
        progress.type = SyncEventsTypes.ReportProgress;
        return this.emit(<SyncReportProgressEvent>progress);
    }

    emitError (error: Error) {
        this.hasErrors = true;
        return this.emit(<SyncErrorEvent>{
            type: SyncEventsTypes.Error,
            error
        });
    }

    async* doSync () {
        this.stats.start();
        this.emit(SyncEventsTypes.Started);
        this.logger.info(`Sync Params
        uuid: ${this.id}
        AppodealAccount: 
            id: ${this.appodealAccountId}
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
            this.emit(SyncEventsTypes.Stopped);
            return;
        }

        try {
            yield* this.syncApps();
        } catch (e) {
            this.logger.error('Failed to syncApps ', e);
            this.emitError(e);
            this.emit(SyncEventsTypes.Stopped);
            return;
        }
    }

    async* fetchDataToSync () {


        yield `refrech Admob xsrf Token`;
        try {
            await retry(async () => this.adMobApi.refreshXsrfToken(), 3, 1000);
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


        this.context.loadAdMob(await this.adMobApi.fetchAppsWitAdUnits());
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

    async* syncApps () {
        let synced = 0,
            failed = 0;

        this.emitProgress({
            synced,
            failed,
            total: this.context.getAppodealAppsCount()
        });

        for (const app of this.context.getAppodealApps()) {
            try {
                this.logger.info('------------------------');
                yield* this.syncApp(app);
                synced++;
            } catch (e) {
                this.stats.errorWhileSync(app);
                failed++;
                this.logger.error(e);
                this.emitError(e);
                yield `Failed to sync App [${app.id}] ${app.name}`;
            }
            this.emitProgress({
                synced,
                failed,
                total: this.context.getAppodealAppsCount()
            });
        }
        this.logger.info('------------------------');
    }


    static toAdMobPlatform (app: AppodealApp): AdMobPlatform {
        if (app.platform === AppodealPlatform.IOS) {
            return AdMobPlatform.IOS;
        }
        return AdMobPlatform.Android;
    }

    async* syncDeletedApp (app: AppodealApp, adMobApp: AdMobApp) {
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

    async* syncApp (app: AppodealApp) {
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
            adMobApp = await this.createAdMobApp(app);
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

        const actualAdUnits = yield* this.syncAdUnits(app, adMobApp);
        yield `AdUnits actualized`;

        await this.appodealApi.reportAppSynced(app, this.id, this.adMobAccount.id, adMobApp, actualAdUnits);
        yield `End Sync  App [${app.id}] ${app.name}`;
    }


    async* syncAdUnits (app: AppodealApp, adMobApp: AdMobApp) {
        const templatesToCreate = this.buildAdUnitsSchema(app);
        const adUnitsToDelete: AdUnitId[] = [];
        const appodealAdUnits = [];

        this.getActiveAdmobAdUnitsCreatedByApp(app, adMobApp).forEach((adMobAdUnit: AdMobAdUnit) => {
            const templateId = Sync.getAdUnitTemplateId(adMobAdUnit);
            if (templatesToCreate.has(templateId)) {
                appodealAdUnits.push(this.convertToAppodealAdUnit(adMobAdUnit, templatesToCreate.get(templateId)));
                templatesToCreate.delete(templateId);
            } else {
                adUnitsToDelete.push(adMobAdUnit.adUnitId);
            }
        });

        this.logger.info(`AdUnits to create ${templatesToCreate.size}. AdUnit to Delete ${adUnitsToDelete.length}. Unchanged AdUnits ${appodealAdUnits.length}`);


        for (const adUnitTemplate of templatesToCreate.values()) {
            if (this.skipNativeAdUnits) {
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

        return appodealAdUnits;
    }

    convertToAppodealAdUnit (adMobAdUnit: AdMobAdUnit, template: AdUnitTemplate): AppodealAdUnit {
        return {
            code: this.adUnitCode(adMobAdUnit),
            ...template.__metadata
        };
    }

    // filter adUnits which user created manually
    // we should work only adUnits created automatically during sync
    getActiveAdmobAdUnitsCreatedByApp (app: AppodealApp, adMobApp: AdMobApp) {
        return this.filterAppAdUnits(app, this.context.getAdMobAppActiveAdUnits(adMobApp));
    }


    filterAppAdUnits (app: AppodealApp, adUnits: AdMobAdUnit[]) {
        const pattern = new RegExp('^' + [
            'Appodeal',
            app.id,
            `(${Object.values(AdType).map((v: string) => v.toLowerCase()).join('|')})`,
            `(${Object.values(Format).map((v: string) => v.toLowerCase()).join('|')})`
        ].join('\/') + '/?');
        this.logger.info(`[AppAdUnits name pattern] ${pattern.toString()}`);

        return adUnits.filter(adUnit => pattern.test(adUnit.name));
    }

    adUnitCode (adUnit: AdMobAdUnit) {
        return `ca-app-${this.adMobAccount.id}/${adUnit.adUnitId}`;
    }

    static adUnitName (app: AppodealApp, adType: AdType, format: Format, cpmFloor?: number) {
        return [
            'Appodeal',
            app.id,
            adType.toLowerCase(),
            format.toLowerCase(),
            cpmFloor ? cpmFloor.toFixed(2) : undefined
        ]
        // to remove empty values
            .filter(v => v)
            .join('/');
    }


    /**
     * Build map of AdUnits which is supposed to be created
     * @param app
     */
    buildAdUnitsSchema (app: AppodealApp): Map<AdUnitTemplateId, AdUnitTemplate> {

        return app.ecpmFloors
            .map(floor => ({floor, template: getAdUnitTemplate(floor.adType)}))
            .filter(({floor, template}) => {
                if (!template) {
                    captureMessage(`Unsupported Ad Type ${floor.adType}`);
                    return false;
                }
                return true;
            })
            .map(({floor, template}) => {
                    return [
                        // default adUnit with no ecpm
                        {
                            ...template,
                            __metadata: {
                                adType: floor.adType,
                                ecpmFloor: 0,
                                format: floor.format
                            },
                            name: Sync.adUnitName(app, floor.adType, floor.format)
                        },
                        // AdUnits for sent ecpm Floors
                        ...floor.ecpmFloor.filter(v => v > 0).map(ecpmFloor => ({
                            ...template,
                            name: Sync.adUnitName(app, floor.adType, floor.format, ecpmFloor),
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


    /**
     * build Template ID from which adUnit is created
     * @param adUnit
     */
    static getAdUnitTemplateId (adUnit: AdMobAdUnit): AdUnitTemplateId {

        return stringify([
            adUnit.name,
            adUnit.adType,
            adUnit.adFormat,
            adUnit.cpmFloorSettings,
            adUnit.googleOptimizedRefreshRate,
            adUnit.rewardsSettings
        ]);
    }

    validateAdmobApp (app: AppodealApp, adMobApp: AdMobApp) {
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

    findAdMobApp (app: AppodealApp, apps: AdMobApp[]): AdMobApp {
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

        const namePattern = new RegExp(`^Appodeal/${app.id}/.*$`);
        adMobApp = apps.find(adMobApp => !adMobApp.hidden && adMobApp.platform === adMobPlatform && namePattern.test(adMobApp.name));
        if (adMobApp) {
            this.logger.info('[FindAdMobApp] Found by NAME pattern');
            return adMobApp;
        }

        this.logger.info('[FindAdMobApp] Failed to find App');
        return null;
    }


    async createAdMobApp (app: AppodealApp): Promise<AdMobApp> {

        const adMobApp: Partial<AdMobApp> = {
            name: ['Appodeal', app.id, app.name].join('/').substr(0, MAX_APP_NAME_LENGTH),
            platform: Sync.toAdMobPlatform(app)
        };

        return this.adMobApi.post('AppService', 'Create', getTranslator(AppTranslator).encode(adMobApp))
            .then(res => getTranslator(AppTranslator).decode(res));
    }


    async showAdMobApp (adMobApp: AdMobApp): Promise<AdMobApp> {
        return this.adMobApi.postRaw('AppService', 'BulkUpdateVisibility', {1: [adMobApp.appId], 2: true})
            .then(() => ({...adMobApp, hidden: false}));
    }

    async hideAdMobApp (adMobApp: AdMobApp): Promise<AdMobApp> {
        return this.adMobApi.postRaw('AppService', 'BulkUpdateVisibility', {1: [adMobApp.appId], 2: false})
            .then(() => ({...adMobApp, hidden: true}));
    }

    async linkAppWithStore (app: AppodealApp, adMobApp: AdMobApp): Promise<AdMobApp> {

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

        interface UpdateAppRequest {
            1: any; // encoded App
            2: { 1: string[] }; // updateMask
        }

        interface UpdateAppResponse {
            1: any; // encoded App
            2: any; // validation Status
        }

        const searchAppResponse: AdMobApp[] = await this.adMobApi.postRaw('AppService', 'Search', <SearchAppRequest>{
            1: app.bundleId,
            2: 0,
            3: 100,
            4: Sync.toAdMobPlatform(app)
        }).then((response: SearchAppResponse) => response[1] ? response[2].map(getTranslator(AppTranslator).decode) : []);

        const publishedApp = searchAppResponse.find(publishedApp => publishedApp.applicationStoreId === app.bundleId);
        if (publishedApp) {
            this.logger.info(`App found in store`);
            this.stats.appUpdated(app);
            adMobApp = {...adMobApp, ...publishedApp};
            return await this.adMobApi.postRaw('AppService', 'Update', <UpdateAppRequest>{
                1: getTranslator(AppTranslator).encode(adMobApp),
                2: {1: ['application_store_id', 'vendor']}
            }).then((res: UpdateAppResponse) => getTranslator(AppTranslator).decode(res[1]));
        }
        this.logger.info(`App NOT found in store`);
        return adMobApp;
    }

    async createAdMobAdUnit (adUnit: Partial<AdMobAdUnit>): Promise<AdMobAdUnit> {
        return this.adMobApi.post('AdUnitService', 'Create', getTranslator(AdUnitTranslator).encode(adUnit))
            .then(res => getTranslator(AdUnitTranslator).decode(res));
    }

    async deleteAdMobAdUnits (ids: string[]) {
        return this.adMobApi.post('AdUnitService', 'BulkRemove', ids);
    }


}
