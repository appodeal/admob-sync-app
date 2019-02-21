import webpack from 'webpack';
import merge from 'webpack-merge';
import defaults, {SRC_PATH} from './default';
import * as path from 'path';
import {environment} from './plugins/environment';

let envConfig = require(path.join(SRC_PATH, '../config/development.json'));

export default (env: webpack.Configuration): webpack.Configuration => {
    return merge(defaults(env), {
        mode: 'development',
        devtool: 'inline-source-map',
        plugins: [
            environment(env, envConfig, {
                development: true,
                index: './build/index.html'
            })
        ]
    })
}