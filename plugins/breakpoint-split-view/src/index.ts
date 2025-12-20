import Plugin from '@jbrowse/core/Plugin'

import BreakpointAlignmentsWidgetF from './BreakpointAlignmentsFeatureDetail'
import BreakpointGetFeaturesF from './BreakpointGetFeatures'
import BreakpointSplitViewF from './BreakpointSplitView'
import LaunchBreakpointSplitViewF from './LaunchBreakpointSplitView'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class BreakpointSplitViewPlugin extends Plugin {
  name = 'BreakpointSplitViewPlugin'

  install(pluginManager: PluginManager) {
    BreakpointSplitViewF(pluginManager)
    BreakpointAlignmentsWidgetF(pluginManager)
    LaunchBreakpointSplitViewF(pluginManager)
    BreakpointGetFeaturesF(pluginManager)
  }

  configure() {}
}
