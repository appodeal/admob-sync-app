import HtmlWebpackPlugin from 'html-webpack-plugin';
import CSSExtractPlugin from 'mini-css-extract-plugin';
import ScriptExtHtmlWebpackPlugin from 'script-ext-html-webpack-plugin';
import CleanWebpackPlugin from 'clean-webpack-plugin';
import GenerateJsonPlugin from 'generate-json-webpack-plugin';
import * as path from 'path';
import webpack from 'webpack';


export const SRC_PATH = path.resolve(__dirname, '../src');
export const BUILD_PATH = path.resolve(__dirname, '../build');
export const DIST_PATH = path.resolve(__dirname, '../dist');
const PACKAGE = require(path.join(__dirname, '../package.json'));

export default (env: webpack.Configuration): webpack.Configuration => {
    return {
        context: SRC_PATH,
        entry: {
            main: path.join(SRC_PATH, './main.ts'),
            settings: path.join(SRC_PATH, './ui/settings/settings.tsx')
        },
        target: 'electron-main',
        output: {
            path: BUILD_PATH,
            filename: '[name].js'
        },
        devtool: 'source-map',
        module: {
            rules: [
                {
                    test: /\.ts|\.tsx$/,
                    use: ['ts-loader']
                },
                {
                    test: /\.(png|svg)$/i,
                    use: [
                        {
                            loader: '@brigad/ideal-image-loader',
                            options: {
                                webp: false,
                                base64: false,
                                palette: false,
                                warnOnMissingSrcset: true,
                                name: '[name].[ext]',
                                publicPath: './assets/images',
                                outputPath: './assets/images'
                            }
                        }
                    ]
                },
                {
                    test: /\.(woff2|ttf|eot)$/,
                    use: [
                        {
                            loader: 'file-loader',
                            options: {
                                name: '[name].[ext]',
                                publicPath: './fonts',
                                outputPath: './assets/fonts'
                            }
                        }
                    ]
                },
                {
                    test: /\.scss$/, use: [
                        CSSExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: {
                                modules: true,
                                sourceMap: true
                            }
                        },
                        {
                            loader: 'sass-loader',
                            options: {
                                sourceMap: true
                            }
                        }
                    ]
                },
                {
                    test: /\.(graphql|gql)$/,
                    exclude: /node_modules/,
                    loader: 'graphql-tag/loader'
                }
            ]
        },
        resolve: {
            extensions: ['.tsx', '.json', '.ts', '.js', '.svg'],
            modules: [
                'node_modules',
                '@typings',
                path.resolve(__dirname, '../src')
            ]
        },
        plugins: [
            new CleanWebpackPlugin(BUILD_PATH, {
                root: path.resolve(__dirname, '../')
            }),
            new CleanWebpackPlugin(DIST_PATH, {
                root: path.resolve(__dirname, '../')
            }),
            new HtmlWebpackPlugin({
                hash: true,
                template: path.join(SRC_PATH, './ui/settings/settings.ejs'),
                chunks: ['settings'],
                inject: 'head',
                filename: 'settings.html'
            }),
            new ScriptExtHtmlWebpackPlugin({
                defaultAttribute: 'defer'
            }),
            new CSSExtractPlugin({
                filename: 'assets/[name].css'
            }),
            new GenerateJsonPlugin('package.json', {
                name: PACKAGE.name,
                author: "Appodeal Inc.",
                main: "main.js",
                productName: PACKAGE.productName,
                version: PACKAGE.version,
                description: PACKAGE.description,
                dependencies: PACKAGE.dependencies || {},
                devDependencies: PACKAGE.devDependencies || {}
            })/*,
            new GenerateJsonPlugin('electron-builder.json', {
                appId: "com.appodeal.AdMob.desktop",
                artifactName: "${name}-${version}-${os}-${arch}.${ext}",
                directories: {
                    buildResources: '../resources',
                    output: '../dist'
                },
                files: {

                },
                mac: {
                    darkModeSupport: true
                },
                win: {
                    target: 'portable',
                    icon: './ui/assets/icon-128.png'
                },
                dmg: {
                    background: '../resources/dmg/background.png',
                    iconSize: 140,
                    iconTextSize: 18
                }
            })*/
        ]
    };
}
