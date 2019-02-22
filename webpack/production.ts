import webpack from 'webpack';
import merge from 'webpack-merge';
import defaults, {ROOT_PATH, SRC_PATH} from './default';
import * as path from 'path';
import {environment} from './plugins/environment';
import GenerateJsonPlugin from 'generate-json-webpack-plugin';

let envConfig = require(path.join(SRC_PATH, '../config/production.json'));

let PACKAGE = require(path.join(ROOT_PATH, 'package.json'));

export default (env: webpack.Configuration): webpack.Configuration => {
    return merge(defaults(env), {
        mode: 'production',
        plugins: [
            environment(env, envConfig, {
                development: false,
                index: './index.html'
            }),
            new GenerateJsonPlugin('package.json', {
                name: PACKAGE.name,
                author: "Appodeal Inc.",
                main: "main.js",
                version: PACKAGE.version,
                description: PACKAGE.description,
                dependencies: PACKAGE.dependencies || {}
            })
        ]
    })
}