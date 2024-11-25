import Plugin from '@jbrowse/core/Plugin'
import { Indexing } from '@jbrowse/core/ui/Icons'
import {
  isAbstractMenuManager,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import JobsListWidgetF from './JobsListWidget'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'

export default class JobsManagementPlugin extends Plugin {
  name = 'JobsManagementPlugin'

  install(pluginManager: PluginManager) {
    JobsListWidgetF(pluginManager)
  }
  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Jobs list',
        icon: Indexing, // TODO: pick a better icon
        onClick: (session: SessionWithWidgets) => {
          if (isSessionModelWithWidgets(session)) {
            const { widgets } = session
            let jobStatusWidget = widgets.get('JobsList')
            if (!jobStatusWidget) {
              jobStatusWidget = session.addWidget('JobsListWidget', 'JobsList')
              session.showWidget(jobStatusWidget)
            } else {
              session.showWidget(jobStatusWidget)
            }
          }
        },
      })
    }
  }
}
