import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import BreakpointAlignmentsWidgetF from './BreakpointAlignmentsFeatureDetail'
import BreakpointSplitViewF from './BreakpointSplitView'

export default class BreakpointSplitViewPlugin extends Plugin {
  name = 'BreakpointSplitViewPlugin'

  install(pluginManager: PluginManager) {
    BreakpointSplitViewF(pluginManager)
    BreakpointAlignmentsWidgetF(pluginManager)
  }

  configure() {}
}
