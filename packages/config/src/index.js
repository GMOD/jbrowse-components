import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import { lazy } from 'react'
import {
  configSchema as ConfigurationEditorConfigSchema,
  HeadingComponent as ConfigurationEditorHeadingComponent,
  ReactComponent as ConfigurationEditorReactComponent,
  stateModelFactory as ConfigurationEditorStateModelFactory,
} from './ConfigurationEditorDrawerWidget'
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
  install(pluginManager) {
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

    pluginManager.addDrawerWidgetType(() => {
      return new DrawerWidgetType({
        name: 'ConfigurationEditorDrawerWidget',
        HeadingComponent: ConfigurationEditorHeadingComponent,
        configSchema: ConfigurationEditorConfigSchema,
        stateModel: ConfigurationEditorStateModelFactory(pluginManager),
        LazyReactComponent: lazy(() => ConfigurationEditorReactComponent),
      })
    })
  }
}

export { default as ConfigurationEditor } from './ConfigurationEditorDrawerWidget/components/ConfigurationEditor'
export { default as JsonEditor } from './ConfigurationEditorDrawerWidget/components/JsonEditor'
