import webpack from 'webpack';
import merge from 'webpack-merge';
import * as path from 'path';
import {environment} from './plugins/environment';
import {entries, SRC_PATH} from "./default";

let envConfig = require(path.join(SRC_PATH, "../config/production.json"));

export default entries.map(entry => (env: webpack.Configuration): webpack.Configuration => {
        return merge(entry(env), {
            mode: 'production',
            plugins: [
                environment(env, envConfig, {
                    development: false,
                    settingsPage: './settings.html'
                })
            ]
        })
    }
);
