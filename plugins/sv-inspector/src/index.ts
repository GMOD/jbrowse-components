import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util/types'
import TableChartIcon from '@mui/icons-material/TableChart'

import LaunchSvInspectorViewF from './LaunchSvInspectorView/index.ts'
import SvInspectorViewF from './SvInspectorView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util/types'

export type { SvInspectorViewModel } from './SvInspectorView/model.ts'
export { svInspectorLaunchKeys } from './SvInspectorView/launchKeys.ts'
export type { SvInspectorViewCommands } from './SvInspectorView/types.ts'

export default class SvInspectorViewPlugin extends Plugin {
  name = 'SvInspectorViewPlugin'

  install(pluginManager: PluginManager) {
    SvInspectorViewF(pluginManager)
    LaunchSvInspectorViewF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Add', {
        label: 'SV inspector',
        icon: TableChartIcon,
        onClick: (session: AbstractViewContainer) => {
          void session.launchView('SvInspectorView', {})
        },
      })
    }
  }
}

// Carries this module's extension-point declaration into the emitted `.d.ts`;
// `scripts/check-extension-point-reachability.ts` is the gate, and its header
// is the why.
export type { LaunchSvInspectorViewArgs } from './LaunchSvInspectorView/index.ts'
