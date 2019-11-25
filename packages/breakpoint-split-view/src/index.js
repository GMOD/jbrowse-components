import { lazy } from 'react'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import {
  configSchema as alignmentsFeatureDetailConfigSchema,
  ReactComponent as AlignmentsFeatureDetailReactComponent,
  stateModel as alignmentsFeatureDetailStateModel,
} from './BreakpointAlignmentsFeatureDetail'

export default class BreakpointSplitViewPlugin {
  install(pluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(require('./BreakpointSplitView')),
    )
    pluginManager.addDrawerWidgetType(
      () =>
        new DrawerWidgetType({
          name: 'BreakpointAlignmentsDrawerWidget',
          heading: 'Breakpoint Feature Details',
          configSchema: alignmentsFeatureDetailConfigSchema,
          stateModel: alignmentsFeatureDetailStateModel,
          LazyReactComponent: lazy(() => AlignmentsFeatureDetailReactComponent),
        }),
    )
  }

  configure() {}
}
