import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { configSchema } from './configSchema'
import { stateModelFactory } from './stateModelFactory'

export default function AlignmentFeatureDetailsF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        ReactComponent: lazy(() => import('./AlignmentsFeatureDetail')),
        configSchema: configSchema,
        heading: 'Feature details',
        name: 'AlignmentsFeatureWidget',
        stateModel: stateModelFactory(pluginManager),
      }),
  )
}
