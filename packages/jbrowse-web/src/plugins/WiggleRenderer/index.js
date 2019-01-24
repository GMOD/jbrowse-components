import Plugin from '../../Plugin'

import renderer from './wiggleRenderer'

export default class DivSequenceRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(renderer)
  }
}
