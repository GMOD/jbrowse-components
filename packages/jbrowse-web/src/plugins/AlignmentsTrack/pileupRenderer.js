import PileupRendering from './components/PileupRendering'
import { RendererType } from '../../Plugin'

class PileupRenderer extends RendererType {}

export default pluginManager =>
  new PileupRenderer({
    name: 'PileupRenderer',
    ReactComponent: PileupRendering,
  })
