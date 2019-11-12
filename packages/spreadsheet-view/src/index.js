export default class SpreadsheetViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SpreadsheetView/SpreadsheetViewType')),
    )
  }

  configure() {
    // nothing
  }
}
