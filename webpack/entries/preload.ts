import * as path from 'path';
import webpack from 'webpack';
import {SRC_PATH} from '../default';


export default (env: webpack.Configuration): webpack.Configuration => {
    return {
        entry: {
            preload: path.join(SRC_PATH, './preload.ts')

        },
        target: 'electron-preload'
    };
}
