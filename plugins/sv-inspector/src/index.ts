import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import {
  AbstractSessionModel,
  isAbstractMenuManager,
} from '@jbrowse/core/util/types'
import TableChartIcon from '@material-ui/icons/TableChart'
import SvInspectorViewTypeFactory from './SvInspectorView/SvInspectorViewType'

export default class SvInspectorViewPlugin extends Plugin {
  name = 'SvInspectorViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(SvInspectorViewTypeFactory),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add view'], {
        label: 'SV inspector',
        icon: TableChartIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('SvInspectorView', {})
        },
      })
    }
  }
}
