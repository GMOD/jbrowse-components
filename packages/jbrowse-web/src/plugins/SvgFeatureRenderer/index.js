import Plugin from '@gmod/jbrowse-core/Plugin'

import renderer from './svgFeatureRenderer'

export default class SvgFeatureRendererPlugin extends Plugin {
  install(pluginManager) {
    pluginManager.addRendererType(renderer)
  }
}
