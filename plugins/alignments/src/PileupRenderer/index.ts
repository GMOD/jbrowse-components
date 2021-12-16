import PluginManager from '@jbrowse/core/PluginManager'
import PileupRenderer from './PileupRenderer'
import ReactComponent from './components/PileupRendering'
import configSchema from './configSchema'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new PileupRenderer({
        name: 'PileupRenderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
