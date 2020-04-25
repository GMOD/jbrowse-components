export default class SvInspectorViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SvInspectorView/SvInspectorViewType')),
    )
  }

  configure(pluginManager) {
    if (pluginManager.rootModel && pluginManager.rootModel.menus) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'SV inspector',
        icon: 'table_chart',
        onClick: session => {
          session.addView('SvInspectorView', {})
        },
      })
    }
  }
}
