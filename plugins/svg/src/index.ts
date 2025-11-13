import Plugin from '@jbrowse/core/Plugin'

import SvgFeatureRendererF from './SvgFeatureRenderer'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class SVGPlugin extends Plugin {
  name = 'SVGPlugin'

  install(pluginManager: PluginManager) {
    SvgFeatureRendererF(pluginManager)
  }
}

export {
  ReactComponent as SvgFeatureRendererReactComponent,
  configSchema as svgFeatureRendererConfigSchema,
} from './SvgFeatureRenderer'
