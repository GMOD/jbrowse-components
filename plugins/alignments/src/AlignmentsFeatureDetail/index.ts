import { lazy } from 'react'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { configSchema } from './configSchema'
import { stateModelFactory } from './stateModelFactory'
import type PluginManager from '@jbrowse/core/PluginManager'

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
