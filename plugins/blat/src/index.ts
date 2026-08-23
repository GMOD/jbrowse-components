import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import BiotechIcon from '@mui/icons-material/Biotech'
import SearchIcon from '@mui/icons-material/Search'

import BlatDialog from './BlatDialog.tsx'
import IsPcrDialog from './IsPcrDialog.tsx'
import UcscResultsWidgetF from './UcscResultsWidget/index.ts'

import type { UcscHost } from './ucscShared.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class BlatPlugin extends Plugin {
  name = 'BlatPlugin'

  install(pluginManager: PluginManager) {
    UcscResultsWidgetF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'BLAT search…',
        icon: SearchIcon,
        onClick: (session: UcscHost) => {
          session.queueDialog(handleClose => [
            BlatDialog,
            { session, handleClose },
          ])
        },
      })
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'In-silico PCR…',
        icon: BiotechIcon,
        onClick: (session: UcscHost) => {
          session.queueDialog(handleClose => [
            IsPcrDialog,
            { session, handleClose },
          ])
        },
      })
    }
  }
}
