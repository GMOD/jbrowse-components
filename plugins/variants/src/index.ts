import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AdapterClass as VcfTabixAdapterClass,
  configSchema as vcfTabixAdapterConfigSchema,
} from './VcfTabixAdapter'
import {
  configSchema as variantFeatureWidgetConfigSchema,
  ReactComponent as VariantFeatureWidgetReactComponent,
  stateModel as variantFeatureWidgetStateModel,
} from './VariantFeatureWidget'
import {
  configSchemaFactory as variantTrackConfigSchemaFactory,
  modelFactory as variantTrackModelFactory,
} from './VariantTrack'
import StructuralVariantChordRendererFactory from './StructuralVariantChordRenderer'
import StructuralVariantChordTrackFactory from './StructuralVariantChordTrack'

export default class VariantsPlugin extends Plugin {
  name = 'VariantsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'VcfTabixAdapter',
          configSchema: vcfTabixAdapterConfigSchema,
          AdapterClass: VcfTabixAdapterClass,
        }),
    )

    pluginManager.addTrackType(() => {
      const configSchema = variantTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'VariantTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: variantTrackModelFactory(configSchema),
      })
    })

    pluginManager.addTrackType(() =>
      pluginManager.jbrequire(StructuralVariantChordTrackFactory),
    )

    pluginManager.addRendererType(() =>
      pluginManager.jbrequire(StructuralVariantChordRendererFactory),
    )

    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'VariantFeatureWidget',
          heading: 'Feature Details',
          configSchema: variantFeatureWidgetConfigSchema,
          stateModel: variantFeatureWidgetStateModel,
          ReactComponent: VariantFeatureWidgetReactComponent,
        }),
    )
  }
}

export { default as VcfFeature } from './VcfTabixAdapter/VcfFeature'
