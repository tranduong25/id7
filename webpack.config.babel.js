import path from 'path';
import EventEmitter from 'events';
import WebpackNotifierPlugin from 'webpack-notifier';
import RemovePlugin from 'remove-files-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { ProvidePlugin } from 'webpack';
import ZipPlugin from 'zip-webpack-plugin';

import PlayFingerprintsPlugin from './build-tooling/PlayFingerprintsPlugin';
import WatchEventsPlugin from './build-tooling/WatchEventsPlugin';

const merge = require('webpack-merge');
const tooling = require('./build-tooling/webpack.tooling');

const version = require('./package.json').version;

const paths = {
  ROOT: __dirname,
  ASSETS: path.join(__dirname, 'dist'),
  ASSETS_IMAGES(basePath) { return path.join(basePath, 'images'); },
  ASSETS_CSS(basePath) { return path.join(basePath, 'css'); },
  ASSETS_FONTS(basePath) { return path.join(basePath, 'fonts'); },
  ASSETS_TEMPLATES(basePath) { return path.join(basePath, 'templates'); },
  BUNDLE: './js/id7-bundle.js',
  ID7: './less/id7.less',
  ID7_DEFAULT_THEME: './less/default-theme.less',
  ID6A: './less/id6a.less',
  NODE_MODULES: path.join(__dirname, 'node_modules'),
  BOOTSTRAP: path.join(__dirname, 'node_modules/bootstrap'),
  FONTAWESOME_FONTS: path.join(__dirname, 'node_modules/@fortawesome/fontawesome-free/webfonts'),
  TEMPLATES: path.join(__dirname, 'templates'),
  PUBLIC_PATH: '/static',
  HOMEPAGE_JS: './js/external-homepage/hp.js',
  HOMEPAGE_LESS: './less/external-homepage/hp.less',
  DOCS_ASSETS: path.join(__dirname, 'docs/dist'),
};

const commonConfig = basePath => merge([
  {
    output: {
      path: basePath,
      publicPath: paths.PUBLIC_PATH,
    },
    node: {
      // Fix Webpack global CSP violation https://github.com/webpack/webpack/issues/6461
      global: false,
    },
    plugins: [
      new ProvidePlugin({
        // Fix Webpack global CSP violation https://github.com/webpack/webpack/issues/6461
        global: require.resolve('./build-tooling/global.js'),
        jQuery: 'jquery',
        $: 'jquery',
      }),
      new PlayFingerprintsPlugin(),
      new RemovePlugin({
        before: {
          root: paths.ROOT,
          include: [basePath],
        },
        after: {
          root: paths.ROOT,
          test: [
            {
              folder: paths.ASSETS_CSS(basePath),
              method: filePath => (new RegExp(/.*\.js.*$/, 'm').test(filePath)),
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        bootstrap: paths.BOOTSTRAP,
      },
    },
  },
  tooling.lintJS(),
  tooling.transpileJS(),
  tooling.copyLocalImages({
    dest: paths.ASSETS_IMAGES(basePath),
  }),
  {
    plugins: [
      new CopyWebpackPlugin([
        {
          from: paths.FONTAWESOME_FONTS,
          to: paths.ASSETS_FONTS(basePath),
        },
        {
          from: paths.TEMPLATES,
          to: paths.ASSETS_TEMPLATES(basePath),
        },
      ]),
    ],
  },
  tooling.extractCSS({
    resolverPaths: [
      paths.NODE_MODULES,
    ],
  }),
  {
    entry: {
      'js/id7-bundle': paths.BUNDLE,
      'css/id7': paths.ID7,
      'css/id7-default-theme': paths.ID7_DEFAULT_THEME,
      'css/id6a': paths.ID6A,
      'external-homepage/js/hp': paths.HOMEPAGE_JS,
      'external-homepage/css/hp': paths.HOMEPAGE_LESS,
    },
  },
]);

const productionConfig = merge([
  {
    mode: 'production',
  },
  tooling.minify(),
  tooling.generateSourceMaps('source-map'),
  {
    plugins: [
      new ZipPlugin({
        filename: `id7-${version}-dist.zip`,
        pathPrefix: 'id7',
        exclude: [/^css\/id6a/, /^images\/id6a/],
      }),
      new ZipPlugin({
        filename: `id6a-${version}-dist.zip`,
        pathPrefix: 'id6a',
        include: [/^css\/id6a/, /^images\/id6a/],
      }),
    ],
  },
]);

const developmentConfig = merge([
  {
    mode: 'development',
    plugins: [
      new WebpackNotifierPlugin(),
      new WatchEventsPlugin({ emitter: new EventEmitter() }),
    ],
  },
  tooling.generateSourceMaps('cheap-module-source-map'),
]);

const docsConfig = merge([
  {
    entry: {
      'docs/css/config-options': './docs/assets/css/config-options.less',
      'docs/css/subsite': './docs/assets/css/subsite.less',
      'docs/site/docs-site': './docs/assets/site/docs-site.less',
      'docs/site/site': './docs/assets/site/site.less',
    },
  },
  {
    plugins: [
      new CopyWebpackPlugin([
        {
          from: './docs/assets/js',
          to: path.join(paths.DOCS_ASSETS, 'docs/js'),
        },
        {
          from: './docs/assets/images',
          to: path.join(paths.DOCS_ASSETS, 'docs/images'),
        },
        {
          from: './docs/assets/id6',
          to: path.join(paths.DOCS_ASSETS, 'docs/id6'),
        },
        {
          from: './docs/assets/external-homepage/images',
          to: path.join(paths.DOCS_ASSETS, 'docs/external-homepage/images'),
        },
        {
          from: './docs/assets/site',
          ignore: ['*.less', '*.js'],
          to: path.join(paths.DOCS_ASSETS, 'docs/site'),
        },
      ]),
    ],
  },
]);

module.exports = ({ production, docs } = {}) => {
  if (production) {
    return merge(commonConfig(paths.ASSETS), productionConfig);
  } else if (docs) {
    return merge(commonConfig(paths.DOCS_ASSETS), productionConfig, docsConfig);
  } else {
    return merge(commonConfig(paths.ASSETS), developmentConfig);
  }
};