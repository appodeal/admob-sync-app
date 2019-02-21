import webpack from 'webpack';
import * as path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CSSExtractPlugin from 'mini-css-extract-plugin';

export const ROOT_PATH = path.resolve('.');
export const SRC_PATH = path.join(ROOT_PATH, './src');
export const BUILD_PATH = path.join(ROOT_PATH, 'build');

export default (env: webpack.Configuration): webpack.Configuration => {
    return {
        context: SRC_PATH,
        entry: {
            main: path.join(SRC_PATH, 'main.ts'),
            index: path.join(SRC_PATH, 'index.ts'),
        },
        target:'electron-renderer',
        output: {
            path: BUILD_PATH,
            filename: '[name].js'
        },
        module: {
            rules: [
                {
                    test: /\.ts|\.tsx$/,
                    use: ['ts-loader']
                },
                {
                    test: /\.(png|svg)$/,
                    use: [{
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            publicPath: '/assets/images',
                            outputPath: 'assets/images'
                        }
                    }]
                    // loader: 'file-loader?name=assets/[name].[ext]',
                },
                {
                    test: /\.(woff2|ttf|eot)$/,
                    use: [{
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            publicPath: '/assets/fonts',
                            outputPath: 'assets/fonts'
                        }
                    }]
                },
                {
                    test: /\.scss$/, use: [CSSExtractPlugin.loader,
                        {
                            loader: 'css-loader',
                            options: {
                                localIdentName: '[path][local]-[hash:base64:5]',
                                modules: true,
                                sourceMap: true,
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
            ]
        },
        resolve: {
            extensions: ['.tsx', '.json', '.ts', '.js']
        },
        plugins: [
            new HtmlWebpackPlugin({
                hash: true,
                template: path.join(SRC_PATH, 'index.ejs'),
                chunks: ['index'],
                filename: 'index.html'
            }),
            new CSSExtractPlugin({
                filename: 'assets/[name].css'
            })
        ]
    };
}
