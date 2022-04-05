import { lazy } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { TextIndexRpcMethod } from './TextIndexRpcMethod/TextIndexRpcMethod'
import {
  stateModelFactory as JobsListStateModelFactory,
  configSchema as JobsListConfigSchema,
} from './JobsListWidget'
export default class extends Plugin {
  name = 'TextIndexingPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRpcMethod(() => new TextIndexRpcMethod(pluginManager))
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'JobsListWidget',
        heading: 'Running jobs',
        configSchema: JobsListConfigSchema,
        stateModel: JobsListStateModelFactory(pluginManager),
        ReactComponent: lazy(
          () =>
            import(
              '@jbrowse/plugin-text-indexing/src/JobsListWidget/components/JobsListWidget'
            ),
        ),
      })
    })
  }
}
