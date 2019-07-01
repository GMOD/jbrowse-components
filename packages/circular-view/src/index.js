export default class CircularViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./CircularView/CircularView')),
    )
  }

  configure() {}
}
