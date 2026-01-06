import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'

import HeadingComponent from './components/HeadingComponent.tsx'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('ConfigurationEditorWidget', {})

const LazyConfigurationEditorComponent = lazy(
  () => import('./components/ConfigurationEditor.tsx'),
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
