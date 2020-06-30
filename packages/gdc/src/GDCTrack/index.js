export default pluginManager => {
  return {
    configSchema: pluginManager.jbrequire(require('./configSchema')),
    stateModel: pluginManager.jbrequire(require('./model')),
  }
}
