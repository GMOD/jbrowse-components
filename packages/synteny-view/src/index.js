export default class SyntenyViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SyntenyView')),
    )
  }

  configure() {}
}
