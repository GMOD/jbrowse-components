import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import TimelineIcon from '@mui/icons-material/Timeline'

import ComparativeRenderer from './ComparativeRenderer/index.ts'
import DiagonalizeDotplotRpc from './DiagonalizeDotplotRpc.ts'
import DotplotDisplayF from './DotplotDisplay/index.ts'
import DotplotReadVsRefMenuItem from './DotplotReadVsRef/index.ts'
import DotplotRendererF from './DotplotRenderer/index.ts'
import DotplotViewF from './DotplotView/index.ts'
import LaunchDotplotViewF from './LaunchDotplotView.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export type { DotplotImportFormSyntenyOption } from './DotplotView/components/ImportForm/TrackSelector'

export default class DotplotPlugin extends Plugin {
  name = 'DotplotPlugin'

  install(pluginManager: PluginManager) {
    DotplotViewF(pluginManager)
    DotplotDisplayF(pluginManager)
    DotplotRendererF(pluginManager)
    LaunchDotplotViewF(pluginManager)
    DotplotReadVsRefMenuItem(pluginManager)

    // install our comparative rendering rpc callback
    pluginManager.addRpcMethod(() => new ComparativeRenderer(pluginManager))
    pluginManager.addRpcMethod(() => new DiagonalizeDotplotRpc(pluginManager))
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Dotplot view',
        icon: TimelineIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('DotplotView', {})
        },
      })
    }
  }
}
