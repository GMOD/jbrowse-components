import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import {
  configSchema as alignmentsFeatureDetailConfigSchema,
  ReactComponent as AlignmentsFeatureDetailReactComponent,
  stateModel as alignmentsFeatureDetailStateModel,
} from './BreakpointAlignmentsFeatureDetail'
import BreakpointSplitViewFactory from './BreakpointSplitView'

export default class BreakpointSplitViewPlugin extends Plugin {
  name = 'BreakpointSplitViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(() =>
      pluginManager.jbrequire(BreakpointSplitViewFactory),
    )
    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'BreakpointAlignmentsWidget',
          heading: 'Breakpoint feature details',
          configSchema: alignmentsFeatureDetailConfigSchema,
          stateModel: alignmentsFeatureDetailStateModel,
          ReactComponent: AlignmentsFeatureDetailReactComponent,
        }),
    )
  }

  configure() {}
}
