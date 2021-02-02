const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');


module.exports = {
    mode: 'development',
    entry: './src/main.js',
    devtool: 'eval-source-map',
    devServer: {
        contentBase: './app',
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, './app/dist'),
        publicPath: '/',
    },
    plugins: [
        new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
        new HtmlWebpackPlugin({
            title: 'Development',
            template: './app/index.html'
        }),
    ],
    module: {
        rules: [
          {
            test: /\.js?$/,
            exclude: /(node_modules)/,
            use: 'babel-loader',
          },
          {
            test:/\.css$/,
            use:['style-loader','css-loader']
          },
          {
            test: /\.(png|jpg|gif)$/i,
            use: [
              {
                loader: 'url-loader',
                options: {
                  limit: 8192,
                },
              },
            ],
          }
        ]
    }
};
