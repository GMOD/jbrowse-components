import Plugin from '@jbrowse/core/Plugin'
import { Indexing } from '@jbrowse/core/ui/Icons'
import {
  isAbstractMenuManager,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

import JobsListWidgetF from './JobsListWidget/index.ts'
import { getOrCreateJobsListWidget } from './getOrCreateJobsListWidget.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export { getOrCreateJobsListWidget } from './getOrCreateJobsListWidget.ts'
export type { JobInput, JobsListModel } from './JobsListWidget/model.ts'
export type { JobState } from './JobsListWidget/jobModel.ts'

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
        // `unknown`, not SessionWithWidgets: MenuItemClickHandler is
        // `(...args: any[]) => void`, so annotating the parameter asserts a
        // shape rather than checking one, and it made the guard below read as
        // redundant with its own signature. It is not — it is the only check
        // there is. Every JBrowse app happens to pass an AppSession, which has
        // widgets, but that is a fact about the app on the other side of a
        // package boundary and an untyped callback contract.
        onClick: (session: unknown) => {
          if (isSessionModelWithWidgets(session)) {
            session.showWidget(getOrCreateJobsListWidget(session))
          }
        },
      })
    }
  }
}
