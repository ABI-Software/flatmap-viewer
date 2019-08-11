const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './src/flatmap-viewer.js',
  externals: [
    nodeExternals({  // Ignore all modules in node_modules folder
      // Except non-javascript files with extensions
      whitelist: [/\.(?!(?:jsx?|json)$).{1,5}$/i],
    }),
  ],
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
