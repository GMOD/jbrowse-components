import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  configSchema as svgFeatureRendererConfigSchema,
  ReactComponent as SvgFeatureRendererReactComponent,
} from './SvgFeatureRenderer'

class SvgFeatureRenderer extends BoxRendererType {
  supportsSVG = true
}

export default class SVGPlugin extends Plugin {
  name = 'SVGPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        new SvgFeatureRenderer({
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: svgFeatureRendererConfigSchema,
          name: 'SvgFeatureRenderer',
          pluginManager,
        }),
    )
  }
}

export {
  configSchema as svgFeatureRendererConfigSchema,
  ReactComponent as SvgFeatureRendererReactComponent,
} from './SvgFeatureRenderer'
