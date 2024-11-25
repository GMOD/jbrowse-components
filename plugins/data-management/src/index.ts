import { lazy } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import AddConnectionWidgetF from './AddConnectionWidget'
import AddTrackWidgetF from './AddTrackWidget'

import HierarchicalTrackSelectorWidgetF from './HierarchicalTrackSelectorWidget'
import PluginStoreWidgetF from './PluginStoreWidget'
import UCSCTrackHubConnectionF from './ucsc-trackhub'
import type PluginManager from '@jbrowse/core/PluginManager'

const AssemblyManager = lazy(() => import('./AssemblyManager'))

export default class DataManagementPlugin extends Plugin {
  name = 'DataManagementPlugin'

  exports = {
    AssemblyManager,
  }

  install(pluginManager: PluginManager) {
    UCSCTrackHubConnectionF(pluginManager)
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
