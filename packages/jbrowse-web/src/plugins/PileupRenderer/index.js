import Plugin from '../../Plugin'

import pileupRenderer from './pileupRenderer'

export default class PileupRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(pileupRenderer)
  }
}
