const cssFilesCache = require('./mastroCache')
// const util = require('util')

module.exports = async function(source) {
  const cb = this.async();

  const displayName = this.resourceQuery.slice(1)

  let css = cssFilesCache.get(this.resourcePath)?.get(displayName)

  // TODO: try to force load module
  // const { resourcePath } = this;
  // if (!css) {
  //   const loadModule = util.promisify((request, done) =>
  //     this.loadModule(request, (err, _, _1, module) => done(err, module)),
  //   );

  //   await loadModule(resourcePath);
  //   css = cssFilesCache.get(this.resourceQuery.slice(1))
  // }

  if (!css) {
    cb(new Error(`Can not find mastro generated css file "${this.resourcePath}"`))
  }

  // hack resource path to be css instead of js
  if (!this._module.matchResource) {
    this._module.matchResource = `${this.resourcePath}--${displayName}.module.css`;
  }

  cb(null, css)
}
