import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { AbstractViewContainer } from '@gmod/jbrowse-core/util/types'

export default class SvInspectorViewPlugin {
  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./SvInspectorView/SvInspectorViewType')),
    )
  }

  configure(pluginManager: PluginManager) {
    if (pluginManager.rootModel && pluginManager.rootModel.menus) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'SV inspector',
        icon: 'table_chart',
        onClick: (session: AbstractViewContainer) => {
          session.addView('SvInspectorView', {})
        },
      })
    }
  }
}
