import Plugin from '@gmod/jbrowse-core/Plugin'

import renderer from './divSequenceRenderer'

export default class DivSequenceRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(renderer)
  }
}
