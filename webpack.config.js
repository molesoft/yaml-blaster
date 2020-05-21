const path = require('path');
const webpack = require('webpack')
var nodeExternals = require('webpack-node-externals');


module.exports = {
  entry: {
    blaster: './src/blaster.js',
    cli: './src/cli.js',

  },
  output: {
    filename: '[name].js',
    path: __dirname + '/dist',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  target: 'node',
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [
              '@babel/plugin-proposal-class-properties',
              new webpack.BannerPlugin('#!/usr/bin/env node')
            ]
          }
        }
      }
    ]
  },
  optimization: {
    minimize: false
  }
};