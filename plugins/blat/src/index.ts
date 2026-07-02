import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import SearchIcon from '@mui/icons-material/Search'

import BlatDialog from './BlatDialog.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export default class BlatPlugin extends Plugin {
  name = 'BlatPlugin'

  install(_pluginManager: PluginManager) {}

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'BLAT search…',
        icon: SearchIcon,
        onClick: (session: AbstractSessionModel) => {
          session.queueDialog(handleClose => [
            BlatDialog,
            { session, handleClose },
          ])
        },
      })
    }
  }
}
