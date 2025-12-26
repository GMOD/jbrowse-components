import BreakpointGetFeatures from './BreakpointGetFeatures'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function BreakpointGetFeaturesF(pluginManager: PluginManager) {
  pluginManager.addRpcMethod(() => new BreakpointGetFeatures(pluginManager))
}
