import { lazy } from 'react'
import Plugin from '@gmod/jbrowse-core/Plugin'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import {
  reactComponent as ConfigurationEditorReactComponent,
  stateModelFactory as ConfigurationEditorStateModelFactory,
  configSchema as ConfigurationEditorConfigSchema,
  HeadingComponent as ConfigurationEditorHeadingComponent,
} from './ConfigurationEditorDrawerWidget'

export default class MainMenuBar extends Plugin {
  install(pluginManager) {
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
  default as JsonEditor,
} from './ConfigurationEditorDrawerWidget/components/JsonEditor'
export {
  FileLocationEditor,
} from './ConfigurationEditorDrawerWidget/components/SlotEditor'
