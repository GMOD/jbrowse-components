import { lazy } from 'react'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  configSchema as ConfigurationEditorConfigSchema,
  HeadingComponent as ConfigurationEditorHeadingComponent,
  stateModelFactory as ConfigurationEditorStateModelFactory,
} from './ConfigurationEditorWidget'
import {
  configSchema as fromConfigAdapterConfigSchema,
  regionsConfigSchema as fromConfigRegionsAdapterConfigSchema,
  sequenceConfigSchema as fromConfigSequenceAdapterConfigSchema,
} from './FromConfigAdapter'
import { configSchema as refNameAliasAdapterConfigSchema } from './RefNameAliasAdapter'

const LazyConfigurationEditorComponent = lazy(
  () => import('./ConfigurationEditorWidget/components/ConfigurationEditor'),
)

export default class extends Plugin {
  name = 'ConfigurationPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'FromConfigAdapter',
          configSchema: fromConfigAdapterConfigSchema,
          getAdapterClass: () =>
            import('./FromConfigAdapter/FromConfigAdapter').then(
              r => r.default,
            ),
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'FromConfigRegionsAdapter',
          configSchema: fromConfigRegionsAdapterConfigSchema,
          getAdapterClass: () =>
            import('./FromConfigAdapter/FromConfigRegionsAdapter').then(
              r => r.default,
            ),
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'FromConfigSequenceAdapter',
          configSchema: fromConfigSequenceAdapterConfigSchema,
          getAdapterClass: () =>
            import('./FromConfigAdapter/FromConfigSequenceAdapter').then(
              r => r.default,
            ),
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'RefNameAliasAdapter',
          configSchema: refNameAliasAdapterConfigSchema,
          getAdapterClass: () =>
            import('./RefNameAliasAdapter/RefNameAliasAdapter').then(
              r => r.default,
            ),
          adapterMetadata: {
            category: null,
            hiddenFromGUI: true,
            displayName: null,
            description: null,
          },
        }),
    )

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
