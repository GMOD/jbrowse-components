import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { SessionWithWidgets, isAbstractMenuManager } from '@jbrowse/core/util'
import { Indexing } from '@jbrowse/core/ui/Icons'
import { isSessionModelWithWidgets } from '@jbrowse/core/util'
import JobsListWidgetF from './JobsListWidget'

export default class extends Plugin {
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
