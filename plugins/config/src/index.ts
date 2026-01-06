import { lazy } from 'react'

import Plugin from '@jbrowse/core/Plugin'

import ConfigurationEditorWidgetF from './ConfigurationEditorWidget/index.ts'
import FromConfigAdapterF from './FromConfigAdapter/index.ts'
import FromConfigRegionsAdapterF from './FromConfigRegionsAdapter/index.ts'
import FromConfigSequenceAdapterF from './FromConfigSequenceAdapter/index.ts'
import NcbiSequenceReportAliasAdapterF from './NcbiSequenceReportAliasAdapter/index.ts'
import RefNameAliasAdapterF from './RefNameAliasAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LazyConfigurationEditorComponent = lazy(
  () =>
    import('./ConfigurationEditorWidget/components/ConfigurationEditor.tsx'),
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
