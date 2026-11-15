import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import { stateModelFactory } from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BreakpointAlignmentsWidgetF(
  pluginManager: PluginManager,
) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'BreakpointAlignmentsWidget',
        discardOnClose: true,
        heading: 'Breakpoint feature details',
        configSchema: ConfigurationSchema('BreakpointAlignmentsWidget', {}),
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazyWithPreload(
          () => import('./BreakpointAlignmentsFeatureDetail.tsx'),
        ),
      }),
  )
}
