import Plugin from '../../Plugin'

import renderer from './lollipopRenderer'

export default class LollipopRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(renderer)
  }
}
