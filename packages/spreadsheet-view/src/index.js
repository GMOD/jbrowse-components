export default class SpreadsheetViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SpreadsheetView/SpreadsheetView')),
    )
  }

  configure() {
    // nothing
  }
}
