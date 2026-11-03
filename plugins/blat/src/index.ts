import Plugin from '@jbrowse/core/Plugin'
import {
  addDisplayMenuItems,
  addViewMenuItems,
} from '@jbrowse/core/pluggableElementTypes'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import BiotechIcon from '@mui/icons-material/Biotech'
import SearchIcon from '@mui/icons-material/Search'

import IsPcrDialog from './IsPcrDialog.tsx'
import UcscResultsWidgetF from './UcscResultsWidget/index.ts'
import { hostServes } from './hostServes.ts'
import { addBlatMenuItems, openBlatDialog } from './launchBlat.ts'

import type { UcscHost } from './ucscShared.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class BlatPlugin extends Plugin {
  name = 'BlatPlugin'

  install(pluginManager: PluginManager) {
    UcscResultsWidgetF(pluginManager)
    // hub configs load this bundle on v4.3.0 too, which serves neither helper,
    // and an install that throws fails the whole config there
    if (hostServes(addViewMenuItems) && hostServes(addDisplayMenuItems)) {
      addBlatMenuItems(pluginManager)
    }
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'BLAT search...',
        icon: SearchIcon,
        onClick: (session: UcscHost) => {
          openBlatDialog(session)
        },
      })
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'In-silico PCR...',
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
