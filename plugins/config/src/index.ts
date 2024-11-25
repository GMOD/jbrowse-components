import { lazy } from 'react'
import Plugin from '@jbrowse/core/Plugin'
import ConfigurationEditorWidgetF from './ConfigurationEditorWidget'
import FromConfigAdapterF from './FromConfigAdapter'
import FromConfigRegionsAdapterF from './FromConfigRegionsAdapter'
import FromConfigSequenceAdapterF from './FromConfigSequenceAdapter'
import NcbiSequenceReportAliasAdapterF from './NcbiSequenceReportAliasAdapter'
import RefNameAliasAdapterF from './RefNameAliasAdapter'
import type PluginManager from '@jbrowse/core/PluginManager'

const LazyConfigurationEditorComponent = lazy(
  () => import('./ConfigurationEditorWidget/components/ConfigurationEditor'),
)

export default class ConfigurationPlugin extends Plugin {
  name = 'ConfigurationPlugin'

  install(pluginManager: PluginManager) {
    FromConfigAdapterF(pluginManager)
    FromConfigRegionsAdapterF(pluginManager)
    FromConfigSequenceAdapterF(pluginManager)
    RefNameAliasAdapterF(pluginManager)
    ConfigurationEditorWidgetF(pluginManager)
    NcbiSequenceReportAliasAdapterF(pluginManager)
  }
}

export { LazyConfigurationEditorComponent as ConfigurationEditor }
