import GenerateJsonPlugin from 'generate-json-webpack-plugin';
import webpack from 'webpack';
import * as path from 'path';
import {PACKAGE, SRC_PATH} from "../default";

export default (env: webpack.Configuration): webpack.Configuration => {
    return {
        entry: {
            main: path.join(SRC_PATH, './main.ts'),
        },
        target: 'electron-main',
        plugins: [
            new GenerateJsonPlugin('package.json', {
                name: PACKAGE.name,
                author: PACKAGE.author,
                main: "main.js",
                productName: PACKAGE.productName,
                version: PACKAGE.version,
                description: PACKAGE.description
            })
        ]
    };
}
