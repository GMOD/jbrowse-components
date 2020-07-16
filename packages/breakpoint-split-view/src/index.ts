import { lazy } from 'react'
import WidgetType from '@gmod/jbrowse-core/pluggableElementTypes/WidgetType'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import Plugin from '@gmod/jbrowse-core/Plugin'
import {
  configSchema as alignmentsFeatureDetailConfigSchema,
  ReactComponent as AlignmentsFeatureDetailReactComponent,
  stateModel as alignmentsFeatureDetailStateModel,
} from './BreakpointAlignmentsFeatureDetail'

export default class BreakpointSplitViewPlugin extends Plugin {
  name = 'BreakpointSplitViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./BreakpointSplitView')),
    )
    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'BreakpointAlignmentsWidget',
          heading: 'Breakpoint Feature Details',
          configSchema: alignmentsFeatureDetailConfigSchema,
          stateModel: alignmentsFeatureDetailStateModel,
          LazyReactComponent: lazy(() => AlignmentsFeatureDetailReactComponent),
        }),
    )
  }

  configure() {}
}
