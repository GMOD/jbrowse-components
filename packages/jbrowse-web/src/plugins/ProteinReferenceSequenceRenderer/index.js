import Plugin from '../../Plugin'

import renderer from './renderer'

export default class ProteinReferenceSequenceRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(renderer)
  }
}
