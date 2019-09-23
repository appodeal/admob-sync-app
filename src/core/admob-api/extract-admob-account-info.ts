import {ExtractedAdmobAccount} from '../../interfaces/common.interfaces';
import {decodeOctString} from '../../lib/oct-decode';


export function extractAccountInfo (responseBody: string): ExtractedAdmobAccount {
    let amrpdSource;
    try {
        let result = /(?<id>pub-\d+)/.exec(responseBody);
        if (!result) {
            return null;
        }

        const {id} = result.groups;
        let email;
        result = /var amrpd = '(?<emailSource>.*?)';/.exec(responseBody);
        amrpdSource = decodeOctString(result.groups.emailSource);
        const amrpd = JSON.parse(amrpdSource);
        email = amrpd[32][3][1];

        return {
            id,
            email
        };
    } catch (e) {
        console.log('JSON amrpdSource', amrpdSource);
        console.warn(e);
    }

    return null;
}
