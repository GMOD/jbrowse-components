import { lazy } from 'react'

import Plugin from '@jbrowse/core/Plugin'

import AddConnectionWidgetF from './AddConnectionWidget/index.ts'
import AddTrackWidgetF from './AddTrackWidget/index.ts'
import HierarchicalTrackSelectorWidgetF from './HierarchicalTrackSelectorWidget/index.ts'
import JB2TrackHubConnectionF from './JB2TrackHubConnection/index.ts'
import UCSCTrackHubConnectionF from './UCSCTrackHubConnection/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const AssemblyManager = lazy(() => import('./AssemblyManager/index.ts'))

export default class DataManagementPlugin extends Plugin {
  name = 'DataManagementPlugin'

  install(pluginManager: PluginManager) {
    UCSCTrackHubConnectionF(pluginManager)
    JB2TrackHubConnectionF(pluginManager)
    AddTrackWidgetF(pluginManager)
    HierarchicalTrackSelectorWidgetF(pluginManager)
    AddConnectionWidgetF(pluginManager)
  }

  configure(_pluginManager: PluginManager) {}
}

export { AssemblyManager }

export type { AddTrackModel } from './AddTrackWidget/model.ts'
export type { HierarchicalTrackSelectorModel } from './HierarchicalTrackSelectorWidget/index.ts'

// Carries this module's extension-point declaration into the emitted `.d.ts`;
// `scripts/check-extension-point-reachability.ts` is the gate, and its header
// is the why.
export type { FolderDialogProps } from './HierarchicalTrackSelectorWidget/components/tree/TrackCategory.tsx'
