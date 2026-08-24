import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util/types'
import TableChartIcon from '@mui/icons-material/TableChart'

import LaunchSvInspectorViewF from './LaunchSvInspectorView/index.ts'
import SvInspectorViewF from './SvInspectorView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractViewContainer } from '@jbrowse/core/util/types'

export type { SvInspectorViewModel } from './SvInspectorView/model.ts'

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
          session.addView('SvInspectorView', {})
        },
      })
    }
  }
}

// Re-exported so the `declare module '@jbrowse/core/PluginManager'` block in
// this module reaches an installed consumer. tsc keeps a module in the emitted
// `.d.ts` only when the entry's public surface names it; a value import used
// inside `install()` is erased, and so was this point's declaration — leaving
// `addToExtensionPoint` on its untyped overload for the external plugin the
// point exists for. `scripts/check-extension-point-reachability.ts` is the gate.
export type { LaunchSvInspectorViewArgs } from './LaunchSvInspectorView/index.ts'
