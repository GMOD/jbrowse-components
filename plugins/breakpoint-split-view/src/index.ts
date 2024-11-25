import Plugin from '@jbrowse/core/Plugin'
import BreakpointAlignmentsWidgetF from './BreakpointAlignmentsFeatureDetail'
import BreakpointSplitViewF from './BreakpointSplitView'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class BreakpointSplitViewPlugin extends Plugin {
  name = 'BreakpointSplitViewPlugin'

  install(pluginManager: PluginManager) {
    BreakpointSplitViewF(pluginManager)
    BreakpointAlignmentsWidgetF(pluginManager)
  }

  configure() {}
}
