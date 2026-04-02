import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import TimelineIcon from '@mui/icons-material/Timeline'

import TubeMapViewF from './TubeMapView/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default class TubeMapViewPlugin extends Plugin {
  name = 'TubeMapViewPlugin'

  install(pluginManager: PluginManager) {
    TubeMapViewF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Tube map view',
        icon: TimelineIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('TubeMapView', {})
        },
      })
    }
  }
}
