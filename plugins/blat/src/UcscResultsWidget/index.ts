import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { configSchema } from './configSchema.ts'
import { stateModelFactory } from './stateModel.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function UcscResultsWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'UcscResultsWidget',
        heading: 'Search results',
        configSchema,
        stateModel: stateModelFactory(),
        ReactComponent: lazyWithPreload(
          () => import('./UcscResultsWidget.tsx'),
        ),
      }),
  )
}
