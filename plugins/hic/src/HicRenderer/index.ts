import HicRenderer from './HicRenderer'
import ReactComponent from './components/HicRendering'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

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
