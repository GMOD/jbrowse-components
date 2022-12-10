import { lazy } from 'react'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  configSchema as ConfigurationEditorConfigSchema,
  HeadingComponent as ConfigurationEditorHeadingComponent,
  stateModelFactory as ConfigurationEditorStateModelFactory,
} from './ConfigurationEditorWidget'
import FromConfigAdapterF from './FromConfigAdapter'
import FromConfigRegionsAdapterF from './FromConfigRegionsAdapter'
import FromConfigSequenceAdapterF from './FromConfigSequenceAdapter'
import RefNameAliasAdapterF from './RefNameAliasAdapter'

const LazyConfigurationEditorComponent = lazy(
  () => import('./ConfigurationEditorWidget/components/ConfigurationEditor'),
)

export default class extends Plugin {
  name = 'ConfigurationPlugin'

  install(pluginManager: PluginManager) {
    FromConfigAdapterF(pluginManager)
    FromConfigRegionsAdapterF(pluginManager)
    FromConfigSequenceAdapterF(pluginManager)
    RefNameAliasAdapterF(pluginManager)

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'ConfigurationEditorWidget',
        HeadingComponent: ConfigurationEditorHeadingComponent,
        configSchema: ConfigurationEditorConfigSchema,
        stateModel: ConfigurationEditorStateModelFactory(pluginManager),
        ReactComponent: LazyConfigurationEditorComponent,
      })
    })
  }
}

export { default as JsonEditor } from './ConfigurationEditorWidget/components/JsonEditor'

export { LazyConfigurationEditorComponent as ConfigurationEditor }
