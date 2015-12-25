
module.exports = {
    devtool:'inline-source-map',
    entry: "./lib/main.js",
    output: {
        path: "./target/",
        filename: "mtl.js"
    },
    module: {
        loaders: [
            {
              test: /\.jsx?$/,
              exclude: /(node_modules|bower_components)/,
              loader: 'babel',
              query: {
                presets: ['es2015']
              }
            }               
        ]
    }
};
