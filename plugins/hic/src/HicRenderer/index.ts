import PluginManager from '@jbrowse/core/PluginManager'

import ReactComponent from './components/HicRendering'
import configSchema from './configSchema'
import HicRenderer from './HicRenderer'

export default function HicRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new HicRenderer({
        name: 'HicRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
