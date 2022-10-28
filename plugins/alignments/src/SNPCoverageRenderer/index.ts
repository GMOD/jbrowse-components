import configSchema from './configSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import SNPCoverageRenderer from './SNPCoverageRenderer'

import { WiggleRendering } from '@jbrowse/plugin-wiggle'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new SNPCoverageRenderer({
        name: 'SNPCoverageRenderer',
        ReactComponent: WiggleRendering,
        configSchema,
        pluginManager,
      }),
  )
}
