import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import PluginManager from '@jbrowse/core/PluginManager'
import stateModelFactory from './model'
import HeadingComponent from './components/HeadingComponent'

const configSchema = ConfigurationSchema('ConfigurationEditorWidget', {})

const LazyConfigurationEditorComponent = lazy(
  () => import('./components/ConfigurationEditor'),
)

export default function registerConfigurationEditorWidget(
  pluginManager: PluginManager,
) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'ConfigurationEditorWidget',
      HeadingComponent,
      configSchema,
      stateModel: stateModelFactory(pluginManager),
      ReactComponent: LazyConfigurationEditorComponent,
    })
  })
}
