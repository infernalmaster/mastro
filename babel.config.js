const { join, dirname, basename, extname, relative} = require('path')

const { mastro } = require('./mastro')

module.exports = (api) => {
  api.cache.using(() => [process.env.NODE_ENV, process.env.BROWSERSLIST_ENV].join('_'))

  const modules = false
  const useBuiltIns = 'entry'

  return {
    presets: [
      [
        '@babel/preset-env',
        {
          modules,
          useBuiltIns,
          corejs: {
            version: '3',
            proposals: true
          }
        }
      ],
      [
        '@babel/preset-react',
        { runtime: 'automatic' }
      ],
      // [
      //   "astroturf/preset",
      //   {
      //     // writeFiles: false
      //   },
      // ],
    ],
    plugins: [
      mastro,
      // ['astroturf/plugin', {
      //   // getRequirePath
      // }],
      [
        '@babel/plugin-transform-runtime',
        {
          corejs: false,
          useESModules: !modules
        }
      ],
      '@babel/plugin-proposal-class-properties'
    ],
    sourceType: 'unambiguous'
  }
}
