import Plugin from '@jbrowse/core/Plugin'

import BreakpointAlignmentsWidgetF from './BreakpointAlignmentsFeatureDetail/index.ts'
import BreakpointGetFeaturesF from './BreakpointGetFeatures/index.ts'
import BreakpointSplitViewF from './BreakpointSplitView/index.ts'
import LaunchBreakpointSplitViewF from './LaunchBreakpointSplitView/index.ts'

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
