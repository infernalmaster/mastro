const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  resolveLoader: {
    alias: {
      "mastro/style-loader": path.join(__dirname, "./mastroStyleLoader")
    }
  },
  entry: './src/index.js',
  mode: 'development',
  devtool: 'eval-cheap-source-map',
  devServer: {
    static: './dist',
  },
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader', 
          {
            loader: 'css-loader',
            options: {
              modules: {
                auto: true,
                localIdentName: '[name]__[local]__[hash:base64:5]'
              }
            }
          },
          'postcss-loader'
        ],
      },
      {
        test: /\.m?js$/,
        exclude: [
          /node_modules\/(?!@calendly\/ui)/
        ],
        use: [
          'babel-loader', 
          // {
          //   loader: 'astroturf/loader',
          //   options: { useAltLoader: true }
          // },
          // '@calendly/ui/astroturf-theme-loader'
        ]
      }
    ]
  }
};
