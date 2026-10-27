import Plugin from '@jbrowse/core/Plugin'

import JobsListWidgetF from './JobsListWidget/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export { getOrCreateJobsListWidget } from './getOrCreateJobsListWidget.ts'
export type { JobsListModel } from './JobsListWidget/model.ts'

export default class JobsManagementPlugin extends Plugin {
  name = 'JobsManagementPlugin'

  install(pluginManager: PluginManager) {
    JobsListWidgetF(pluginManager)
  }
}
