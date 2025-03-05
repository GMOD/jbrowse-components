import LollipopRenderer from './LollipopRenderer'
import ReactComponent from './components/LollipopRendering'
import configSchema from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LollipopRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new LollipopRenderer({
        name: 'LollipopRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
