import {captureMessage} from '@sentry/core';
import {AdmobApiService} from 'core/admob-api/admob.api';
import {AppodealApiService} from 'core/appdeal-api/appodeal-api.service';
import {AdMobAccount} from 'core/appdeal-api/interfaces/admob-account.interface';
import {AdType, AppodealAdUnit, AppodealApp, AppodealPlatform, Format} from 'core/appdeal-api/interfaces/appodeal-app.interface';
import {AppodealAccount} from 'core/appdeal-api/interfaces/appodeal.account.interface';
import {getAdUnitTemplate} from 'core/sync-apps/ad-unit-templates';
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
        public readonly id: string
    ) {
        this.id = id || uuid.v4();
    }

    async stop (reason: string) {
        if (this.terminated) {
            this.logger.info(`Sync already stopped. New Stop Reason: ${reason}`);
            return;
        }
        this.terminated = true;
        this.logger.info(`Stopping Sync Reason: ${reason}`);
    }

    async run () {
        this.logger.info(`Sync started`);
        this.terminated = false;
        await this.appodealApi.reportSyncStart(this.id, this.adMobAccount.id);
        for await (const value of this.doSync()) {
            this.logger.info(value);
            if (this.terminated) {
                this.logger.info(`Sync Terminated`);
                await this.finish();
                return;
            }
        }
        this.logger.info(`Sync finished completely ${this.hasErrors ? 'with ERRORS!' : ''}`);
        await this.finish();
    }

    async finish () {
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


        this.emit(SyncEventsTypes.Started);
        this.logger.info(`Sync Params
        uuid: ${this.id}
        AppodealAccount: '${this.appodealAccountId}}'
        AdmobAccount: '${this.adMobAccount.id}}': '${this.adMobAccount.email}}'
        `);

        yield `refrech Admob xsrf Token`;
        try {
            await retry(() => this.adMobApi.refreshXsrfToken(), 3, 1000);
        } catch (e) {
            this.emitError(e);
            this.emit(SyncEventsTypes.UserActionsRequired);
            this.terminated = true;
            yield 'Terminated as User Actions is Required';
            return;
        }

        yield `Admob xsrf Token Updated`;

        this.emit(SyncEventsTypes.CalculatingProgress);


        this.context.loadAdMob(await this.adMobApi.fetchAppsWitAdUnits());
        yield 'Admob Apps and AdUnits fetched';


        const accountDetails = await this.appodealApi.fetchApps(this.adMobAccount.id);
        this.context.addAppodealApps(accountDetails.apps.nodes);
        yield `Appodeal Apps page 1/'${accountDetails.apps.pageInfo.totalPages}' fetched`;

        if (accountDetails.apps.pageInfo.totalPages) {
            for (let pageNumber = 2; pageNumber <= accountDetails.apps.pageInfo.totalPages; pageNumber++) {
                const page = await this.appodealApi.fetchApps(this.adMobAccount.email, pageNumber);
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

        const adUnitsToDelete = this.filterAppAdUnits(app, this.context.getAdMobAppAdUnits(adMobApp)).map(adUnit => adUnit.adUnitId);
        if (adUnitsToDelete.length) {
            await this.deleteAdMobAdUnits(adUnitsToDelete);
            yield `${adUnitsToDelete.length} adUnits deleted`;
        } else {
            yield `No AdUnits to delete`;
        }


        if (!adMobApp.hidden && !this.context.getAdMobAppAdUnits(adMobApp).length) {
            yield `Hide App`;
            adMobApp = await this.hideAdMobApp(adMobApp);
            this.context.updateAdMobApp(adMobApp);
            yield `App Hidden`;
        }

    }

    async* syncApp (app: AppodealApp) {
        yield `Start Sync App [${app.id}] ${app.name}`;

        let adMobApp = this.findAdMobApp(app, this.context.adMob.apps);
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
            yield `App created`;
        }

        if (adMobApp.hidden) {
            adMobApp = await this.showAdMobApp(adMobApp);
            this.context.updateAdMobApp(adMobApp);
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

        const actualAdUnits = await this.syncAdUnits(app, adMobApp, this.context.getAdMobAppAdUnits(adMobApp));
        yield `AdUnits actualized`;

        await this.appodealApi.reportAppSynced(app, this.id, this.adMobAccount.id, adMobApp, actualAdUnits);
        yield `End Sync  App [${app.id}] ${app.name}`;
    }


    async syncAdUnits (app: AppodealApp, adMobApp: AdMobApp, allAppAdUnits: AdMobAdUnit[]) {
        const templatesToCreate = this.buildAdUnitsSchema(app);
        const adUnitsToDelete: AdUnitId[] = [];
        const appodealAdUnits = [];

        // filter adUnits which user created manually
        // we should work only adUnits created automatically during sync
        // exclude archived too
        this.filterAppAdUnits(
            app,
            allAppAdUnits.filter(adUnit => adUnit.archived !== true)
        ).forEach((adMobAdUnit: AdMobAdUnit) => {
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
                this.logger.info(`AdUnit Created ${this.adUnitCode(newAdUnit)} ${adUnitTemplate.name}`);
                appodealAdUnits.push(this.convertToAppodealAdUnit(newAdUnit, adUnitTemplate));
            }
        }

        // delete bad AdUnits
        if (adUnitsToDelete.length) {
            await this.deleteAdMobAdUnits(adUnitsToDelete);
            this.context.removeAdMobAdUnits(adUnitsToDelete);
        }

        return appodealAdUnits;
    }

    convertToAppodealAdUnit (adMobAdUnit: AdMobAdUnit, template: AdUnitTemplate): AppodealAdUnit {
        return {
            code: this.adUnitCode(adMobAdUnit),
            ...template.__metadata
        };
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
            .map(({floor, template}, i, ar) => {
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


    findAdMobApp (app: AppodealApp, apps: AdMobApp[]): AdMobApp {
        const adMobPlatform = Sync.toAdMobPlatform(app);
        let adMobApp = apps.find(adMobApp => adMobApp.applicationStoreId === app.bundleId && adMobApp.platform === adMobPlatform);

        if (adMobApp) {
            this.logger.info('[FindAdMobApp] Found by bundle ID');
            return adMobApp;
        }

        if (app.admobAppId) {
            adMobApp = apps.find(adMobApp => adMobApp.appId === app.admobAppId);
            if (adMobApp) {
                this.logger.info('[FindAdMobApp] Found by adMobAppId');
                return adMobApp;
            } else {
                this.logger.info('[FindAdMobApp] has INVALID adMobAppId');
            }
        }

        const namePattern = new RegExp(`^Appodeal/${app.id}/.*$`);
        adMobApp = apps.find(adMobApp => namePattern.test(adMobApp.name));
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
            .then(() => ({...adMobApp, hidden: true}));
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
