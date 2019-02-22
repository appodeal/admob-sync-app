import * as path from 'path';
import webpack from 'webpack';
import merge from 'webpack-merge';
import defaults, {SRC_PATH} from './default';
import {environment} from './plugins/environment';


let envConfig = require(path.join(SRC_PATH, '../config/production.json'));



export default (env: webpack.Configuration): webpack.Configuration => {
    return merge(defaults(env), {
        mode: 'production',
        plugins: [
            environment(env, envConfig, {
                development: false,
                settingsPage: './settings.html'
            })
        ]
    });
}
