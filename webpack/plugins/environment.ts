import webpack from 'webpack';

export const environment = (envWebpack: webpack.Configuration, config: any, options: any) => new webpack.DefinePlugin({
    environment: JSON.stringify({
        ...config.environment,
        ...options
    }),
});
