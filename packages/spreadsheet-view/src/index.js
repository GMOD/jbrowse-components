export default class CircularViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SpreadsheetView/SpreadsheetView')),
    )
  }

  configure() {}
}
