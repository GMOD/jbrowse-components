import Plugin from '@jbrowse/core/Plugin'
import { isAbstractMenuManager, isSessionModelWithWidgets } from '@jbrowse/core/util'
import Search from '@mui/icons-material/Search'

import SequenceSearchWidgetF from './SequenceSearchWidget/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'

export default class SequenceSearchPlugin extends Plugin {
  name = 'SequenceSearchPlugin'

  install(pluginManager: PluginManager) {
    SequenceSearchWidgetF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Sequence search',
        icon: Search,
        onClick: (session: SessionWithWidgets) => {
          if (isSessionModelWithWidgets(session)) {
            const widget = session.addWidget(
              'SequenceSearchWidget',
              `SequenceSearch-${Date.now()}`,
            )
            session.showWidget(widget)
          }
        },
      })
    }
  }
}
