export default class SpreadsheetViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SpreadsheetView/SpreadsheetViewType')),
    )
  }

  configure(pluginManager) {
    if (pluginManager.rootModel && pluginManager.rootModel.menus) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Tabular data',
        icon: 'view_comfy',
        onClick: session => {
          session.addView('SpreadsheetView', {})
        },
      })
    }
  }
}
