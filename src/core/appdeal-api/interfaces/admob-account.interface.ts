import {AppodealApp} from 'core/appdeal-api/interfaces/appodeal-app.interface';
import {UserAccount} from 'interfaces/common.interfaces';


export interface AdMobAccount extends UserAccount {
    isReadyForReports: boolean;
    __typename: string;
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
