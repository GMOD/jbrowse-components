import Plugin from '../../Plugin'

import renderer from './svgFeatureRenderer'

export default class SvgFeatureRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(renderer)
  }
}
