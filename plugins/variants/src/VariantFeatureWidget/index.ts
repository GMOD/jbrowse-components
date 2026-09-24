import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { configSchema } from './configSchema.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function VariantFeatureWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'VariantFeatureWidget',
        heading: 'Feature details',
        configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazyWithPreload(
          () => import('./VariantFeatureWidget.tsx'),
        ),
      }),
  )
}
