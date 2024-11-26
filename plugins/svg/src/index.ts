import Plugin from '@jbrowse/core/Plugin'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'

import {
  ReactComponent as SvgFeatureRendererReactComponent,
  configSchema as svgFeatureRendererConfigSchema,
} from './SvgFeatureRenderer'

import type PluginManager from '@jbrowse/core/PluginManager'

class SvgFeatureRenderer extends BoxRendererType {
  supportsSVG = true
}

export default class SVGPlugin extends Plugin {
  name = 'SVGPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        new SvgFeatureRenderer({
          name: 'SvgFeatureRenderer',
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: svgFeatureRendererConfigSchema,
          pluginManager,
        }),
    )
  }
}

export {
  ReactComponent as SvgFeatureRendererReactComponent,
  configSchema as svgFeatureRendererConfigSchema,
} from './SvgFeatureRenderer'
