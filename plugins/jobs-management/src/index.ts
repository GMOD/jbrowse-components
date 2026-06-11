import Plugin from '@jbrowse/core/Plugin'
import { Indexing } from '@jbrowse/core/ui/Icons'
import {
  isAbstractMenuManager,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

import JobsListWidgetF from './JobsListWidget/index.ts'
import { getOrCreateJobsListWidget } from './getOrCreateJobsListWidget.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'

export { getOrCreateJobsListWidget } from './getOrCreateJobsListWidget.ts'
export type { JobsListModel } from './JobsListWidget/model.ts'

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
            session.showWidget(getOrCreateJobsListWidget(session))
          }
        },
      })
    }
  }
}
