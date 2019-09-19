import CopyPlugin from 'copy-webpack-plugin';
import GenerateJsonPlugin from 'generate-json-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CSSExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import webpack from 'webpack';
import {patchMinimalVersion} from '../../chrome-extension/background/utils/minimal-version';
import manifestTemplate from '../../chrome-extension/manifest.json';


const SRC_PATH = path.resolve(__dirname, '../../chrome-extension');

export const BUILD_PATH = path.resolve(__dirname, '../../build/extension');
export const LEGACY_PATH = path.resolve(SRC_PATH, './legacy');

export default (env: webpack.Configuration): webpack.Configuration => {
    return {
        context: SRC_PATH,
        entry: {
            'background': path.resolve(SRC_PATH, 'background/background.ts'),
            'admob-content-script': path.resolve(SRC_PATH, 'content-scripts/admob-content-script.ts'),
            'oauth-success-content-script': path.resolve(SRC_PATH, 'content-scripts/oauth-success-content-script.ts'),
            'sentry': path.resolve(SRC_PATH, 'content-scripts/sentry-content-script.ts'),
            'popup': path.resolve(SRC_PATH, 'popup/popup-index.tsx')
        },
        output: {
            path: BUILD_PATH,
            filename: '[name].js'
        },
        target: 'web',
        plugins: [
            new HtmlWebpackPlugin({
                hash: true,
                template: path.join(SRC_PATH, './popup/popup.ejs'),
                chunks: ['popup'],
                inject: 'body',
                filename: 'popup.html'
            }),
            new CSSExtractPlugin({
                filename: 'assets/[name].css'
            }),
            new CopyPlugin([
                {
                    from: path.join(LEGACY_PATH),
                    to: './'
                }
            ]),
            new GenerateJsonPlugin('manifest.json', {
                ...manifestTemplate,
                version: patchMinimalVersion(process.env.npm_package_version)
            })

        ],
        optimization: {
            minimize: false
        }
    };
}
