import Plugin from '@jbrowse/core/Plugin'

import CanvasFeatureRendererF from './CanvasFeatureRenderer'
import SvgFeatureRendererF from './SvgFeatureRenderer'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class SVGPlugin extends Plugin {
  name = 'SVGPlugin'

  install(pluginManager: PluginManager) {
    // SvgFeatureRendererF(pluginManager)
    CanvasFeatureRendererF(pluginManager)
  }
}

export {
  ReactComponent as SvgFeatureRendererReactComponent,
  configSchema as svgFeatureRendererConfigSchema,
} from './SvgFeatureRenderer'
export { configSchema as canvasFeatureRendererConfigSchema } from './CanvasFeatureRenderer'
