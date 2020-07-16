import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import WidgetType from '@gmod/jbrowse-core/pluggableElementTypes/WidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { lazy } from 'react'
import {
  configSchema as ConfigurationEditorConfigSchema,
  HeadingComponent as ConfigurationEditorHeadingComponent,
  ReactComponent as ConfigurationEditorReactComponent,
  stateModelFactory as ConfigurationEditorStateModelFactory,
} from './ConfigurationEditorWidget'
import {
  AdapterClass as FromConfigAdapterClass,
  SequenceAdapterClass as FromConfigSequenceAdapterClass,
  configSchema as fromConfigAdapterConfigSchema,
  sequenceConfigSchema as fromConfigSequenceAdapterConfigSchema,
} from './FromConfigAdapter'
import {
  AdapterClass as RefNameAliasAdapterClass,
  configSchema as refNameAliasAdapterConfigSchema,
} from './RefNameAliasAdapter'

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
        LazyReactComponent: lazy(() => ConfigurationEditorReactComponent),
      })
    })
  }
}

export { default as ConfigurationEditor } from './ConfigurationEditorWidget/components/ConfigurationEditor'
export { default as JsonEditor } from './ConfigurationEditorWidget/components/JsonEditor'
