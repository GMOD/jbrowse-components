import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import { lazy } from 'react'
import {
  configSchema as ConfigurationEditorConfigSchema,
  HeadingComponent as ConfigurationEditorHeadingComponent,
  reactComponent as ConfigurationEditorReactComponent,
  stateModelFactory as ConfigurationEditorStateModelFactory,
} from './ConfigurationEditorDrawerWidget'
import {
  AdapterClass as FromConfigAdapterClass,
  configSchema as fromConfigAdapterConfigSchema,
} from './FromConfigAdapter'

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

export {
  default as ConfigurationEditor,
} from './ConfigurationEditorDrawerWidget/components/ConfigurationEditor'
export {
  default as JsonEditor,
} from './ConfigurationEditorDrawerWidget/components/JsonEditor'
export {
  FileLocationEditor,
} from './ConfigurationEditorDrawerWidget/components/SlotEditor'
