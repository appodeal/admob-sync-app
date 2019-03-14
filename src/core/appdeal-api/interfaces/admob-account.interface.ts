import {AppodealApp} from 'core/appdeal-api/interfaces/appodeal-app.interface';


export interface AdMobAccount {
    id: string;
    email: string;
    reportsAvailable: boolean;
}

export interface AdMobAccountDetails extends AdMobAccount {
    apps: AppCollectionPagination;
}

export interface AppCollectionPagination {
    nodes: AppodealApp[];
    pageInfo: PageInfo;
    totalCount: number;
}

export interface PageInfo {
    currentPage: number;
    totalPages: number;
    pageSize: number;
}
