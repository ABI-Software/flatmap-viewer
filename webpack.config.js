const path = require('path');

module.exports = {
  entry: './src/flatmap-viewer.js',
  output: {
    path: path.resolve('./dist'),
    filename: 'flatmap-viewer.js',
    libraryTarget: 'commonjs2',
  },
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
      }
    ]
  }
};
