import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { configSchema } from './configSchema.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function AlignmentFeatureDetailsF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'AlignmentsFeatureWidget',
        heading: 'Feature details',
        configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazyWithPreload(
          () => import('./AlignmentsFeatureDetail.tsx'),
        ),
      }),
  )
}
