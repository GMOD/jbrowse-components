import SNPCoverageRenderer from './SNPCoverageRenderer'
import ReactComponent from './components/SNPCoverageRendering'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new SNPCoverageRenderer({
        name: 'SNPCoverageRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
