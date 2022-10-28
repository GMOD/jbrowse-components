import Plugin from '@jbrowse/core/Plugin'

import DotplotViewF from './DotplotView'
import DotplotDisplayF from './DotplotDisplay'
import DotplotRendererF from './DotplotRenderer'
import LaunchDotplotViewF from './LaunchDotplotView'

import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

import TimelineIcon from '@mui/icons-material/Timeline'

import ComparativeRender from './DotplotRenderer/ComparativeRenderRpc'
import { dotplotReadVsRef } from './extensionPoints'

export default class DotplotPlugin extends Plugin {
  name = 'DotplotPlugin'

  install(pluginManager: PluginManager) {
    DotplotViewF(pluginManager)
    DotplotDisplayF(pluginManager)
    DotplotRendererF(pluginManager)
    LaunchDotplotViewF(pluginManager)

    // install our comparative rendering rpc callback
    pluginManager.addRpcMethod(() => new ComparativeRender(pluginManager))
    dotplotReadVsRef(pluginManager)
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
