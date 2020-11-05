import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import {
  configSchema as svgFeatureRendererConfigSchema,
  ReactComponent as SvgFeatureRendererReactComponent,
} from './SvgFeatureRenderer'

import {
  configSchema as featuresTrackConfigSchema,
  modelFactory as featuresTrackModelFactory,
} from './LinearFeatureDisplay'

export default class SVGPlugin extends Plugin {
  name = 'SVGPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        new BoxRendererType({
          name: 'SvgFeatureRenderer',
          ReactComponent: SvgFeatureRendererReactComponent,
          configSchema: svgFeatureRendererConfigSchema,
        }),
    )

    pluginManager.addDisplayType(() => {
      const configSchema = featuresTrackConfigSchema(pluginManager)
      return new DisplayType({
        name: 'LinearFeatureDisplay',
        configSchema,
        stateModel: featuresTrackModelFactory(configSchema),
        trackType: 'FeatureTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })
  }
}

export { svgFeatureRendererConfigSchema, SvgFeatureRendererReactComponent }
