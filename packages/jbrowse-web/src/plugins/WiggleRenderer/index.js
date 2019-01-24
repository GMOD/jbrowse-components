import Plugin from '../../Plugin'

import renderer from './wiggleRenderer'

export default class WiggleRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(renderer)
  }
}
