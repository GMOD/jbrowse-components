import Plugin from '@gmod/jbrowse-core/Plugin'

import renderer from './renderer'

export default class ProteinReferenceSequenceRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(renderer)
  }
}
