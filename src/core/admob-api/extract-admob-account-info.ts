import {ExtractedAdmobAccount} from '../../interfaces/common.interfaces';
import {decodeOctString} from '../../lib/oct-decode';


function extractObjectFromJsonString (str) {
    let open = 0;
    let close = 0;
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '{') {
            open++;
        }
        if (str[i] === '}') {
            close++;
        }
        if (open > 0 && close === open) {
            return str.substr(0, i+1);
        }
    }
    return false;
}

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

        const shortObj =  extractObjectFromJsonString(/(.*)"32":(?<emailSource>.*)/.exec(amrpdSource).groups.emailSource)

        const amrpd = JSON.parse(shortObj);
        email = amrpd[3][1];

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
