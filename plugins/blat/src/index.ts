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

// Hub configs load this bundle on v4.3.0 too, which serves neither menu helper
// nor `lazyWithPreload`, and whose session cannot add the result track. There
// the plugin installs nothing, since an install that throws fails the whole
// config and a dialog whose query throws is no better.
function hostRunsBlat() {
  return hostServes(addViewMenuItems) && hostServes(addDisplayMenuItems)
}

export default class BlatPlugin extends Plugin {
  name = 'BlatPlugin'

  install(pluginManager: PluginManager) {
    if (hostRunsBlat()) {
      UcscResultsWidgetF(pluginManager)
      addBlatMenuItems(pluginManager)
    }
  }

  configure(pluginManager: PluginManager) {
    if (hostRunsBlat() && isAbstractMenuManager(pluginManager.rootModel)) {
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
