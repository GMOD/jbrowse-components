import { lazy } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import FromConfigAdapterF from './FromConfigAdapter'
import FromConfigRegionsAdapterF from './FromConfigRegionsAdapter'
import FromConfigSequenceAdapterF from './FromConfigSequenceAdapter'
import RefNameAliasAdapterF from './RefNameAliasAdapter'
import ConfigurationEditorWidgetF from './ConfigurationEditorWidget'

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
    ConfigurationEditorWidgetF(pluginManager)
  }
}

export { default as JsonEditor } from './ConfigurationEditorWidget/components/JsonEditor'

export { LazyConfigurationEditorComponent as ConfigurationEditor }
