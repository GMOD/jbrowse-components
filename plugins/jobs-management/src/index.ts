import { lazy } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { SessionWithWidgets, isAbstractMenuManager } from '@jbrowse/core/util'
import { Indexing } from '@jbrowse/core/ui/Icons'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import {
  stateModelFactory as JobsListStateModelFactory,
  configSchema as JobsListConfigSchema,
} from '../../jobs-management/src/JobsListWidget'
export default class extends Plugin {
  name = 'JobsManagementPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'JobsListWidget',
        heading: 'Running jobs',
        configSchema: JobsListConfigSchema,
        stateModel: JobsListStateModelFactory(pluginManager),
        ReactComponent: lazy(
          () =>
            import(
              '../../jobs-management/src/JobsListWidget/components/JobsListWidget'
            ),
        ),
      })
    })
  }
  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Jobs list',
        icon: Indexing, // TODO: pick a better icon
        onClick: (session: SessionWithWidgets) => {
          const widget = session.addWidget('JobsListWidget', 'jobsListWidget')
          session.showWidget(widget)
        },
      })
    }
  }
}
