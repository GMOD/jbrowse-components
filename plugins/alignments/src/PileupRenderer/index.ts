import PluginManager from '@jbrowse/core/PluginManager'
import PileupRenderer from './PileupRenderer'
import configSchema from './configSchema'
import ReactComponent from './components/PileupRendering'

export default function register(pluginManager: PluginManager) {
  pluginManager.addRendererType(() => {
    return new PileupRenderer({
      ReactComponent,
      configSchema,
      displayName: 'Pileup renderer',
      name: 'PileupRenderer',
      pluginManager,
    })
  })
}
