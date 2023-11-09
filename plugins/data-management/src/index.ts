import { lazy } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import UCSCHubConnectionF from './ucsc-hubs'
import AddTrackWidgetF from './AddTrackWidget'

import AddConnectionWidgetF from './AddConnectionWidget'
import PluginStoreWidgetF from './PluginStoreWidget'
import HierarchicalTrackSelectorWidgetF from './HierarchicalTrackSelectorWidget'

const AssemblyManager = lazy(() => import('./AssemblyManager'))

export default class extends Plugin {
  name = 'DataManagementPlugin'

  exports = {
    AssemblyManager,
  }

  install(pluginManager: PluginManager) {
    UCSCHubConnectionF(pluginManager)
    AddTrackWidgetF(pluginManager)
    HierarchicalTrackSelectorWidgetF(pluginManager)
    AddConnectionWidgetF(pluginManager)
    PluginStoreWidgetF(pluginManager)
  }

  configure(_pluginManager: PluginManager) {}
}

export { AssemblyManager }

export { type AddTrackModel } from './AddTrackWidget/model'
export { type HierarchicalTrackSelectorModel } from './HierarchicalTrackSelectorWidget'
