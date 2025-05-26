const path = require('path');

module.exports = {
  mode: 'production', // Use 'production' for optimized output
  entry: {
    content_script: './src/content_script.js', // Entry point for the content script
    popup: './src/popup.js' // Entry point for the popup script
  },
  output: {
    path: path.resolve(__dirname, 'dist'), // Output directory
    filename: '[name].js' // Output filenames will match entry names (e.g., content_script.js, popup.js)
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Process JavaScript files
        exclude: /node_modules/, // Exclude dependencies
        use: {
          loader: 'babel-loader', // Use Babel for compatibility
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};