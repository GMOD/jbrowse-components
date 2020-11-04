import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  configSchema as svgFeatureRendererConfigSchema,
  ReactComponent as SvgFeatureRendererReactComponent,
} from './SvgFeatureRenderer'

import {
  configSchema as featuresTrackConfigSchema,
  modelFactory as featuresTrackModelFactory,
} from './FeatureTrack'

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
    pluginManager.addTrackType(() => {
      const configSchema = featuresTrackConfigSchema(pluginManager)
      return new TrackType({
        name: 'FeatureTrack',
        stateModel: featuresTrackModelFactory(configSchema),
        configSchema,
        compatibleView: 'LinearGenomeView',
      })
    })
  }
}

export { svgFeatureRendererConfigSchema, SvgFeatureRendererReactComponent }
