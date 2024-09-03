import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { configSchema } from './configSchema'
import { stateModelFactory } from './stateModelFactory'

export default function AlignmentFeatureDetailsF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'AlignmentsFeatureWidget',
        heading: 'Feature details',
        configSchema: configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(() => import('./AlignmentsFeatureDetail')),
      }),
  )
}
