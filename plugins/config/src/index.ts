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
  AdapterClass as FromConfigAdapterClass,
  RegionsAdapterClass as FromConfigRegionsAdapterClass,
  SequenceAdapterClass as FromConfigSequenceAdapterClass,
  configSchema as fromConfigAdapterConfigSchema,
  regionsConfigSchema as fromConfigRegionsAdapterConfigSchema,
  sequenceConfigSchema as fromConfigSequenceAdapterConfigSchema,
} from './FromConfigAdapter'
import {
  AdapterClass as RefNameAliasAdapterClass,
  configSchema as refNameAliasAdapterConfigSchema,
} from './RefNameAliasAdapter'

const ConfigurationEditorComponent = lazy(
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
          AdapterClass: FromConfigAdapterClass,
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'FromConfigRegionsAdapter',
          configSchema: fromConfigRegionsAdapterConfigSchema,
          AdapterClass: FromConfigRegionsAdapterClass,
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'FromConfigSequenceAdapter',
          configSchema: fromConfigSequenceAdapterConfigSchema,
          AdapterClass: FromConfigSequenceAdapterClass,
        }),
    )
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'RefNameAliasAdapter',
          configSchema: refNameAliasAdapterConfigSchema,
          AdapterClass: RefNameAliasAdapterClass,
        }),
    )

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'ConfigurationEditorWidget',
        HeadingComponent: ConfigurationEditorHeadingComponent,
        configSchema: ConfigurationEditorConfigSchema,
        stateModel: ConfigurationEditorStateModelFactory(pluginManager),
        ReactComponent: ConfigurationEditorComponent,
      })
    })
  }
}

export { default as JsonEditor } from './ConfigurationEditorWidget/components/JsonEditor'

export { ConfigurationEditorComponent as ConfigurationEditor }
