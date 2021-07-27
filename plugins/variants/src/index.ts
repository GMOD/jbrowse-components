import { lazy } from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import ChordVariantDisplay from './ChordVariantDisplay'
import {
  configSchemaFactory as linearVariantDisplayConfigSchemaFactory,
  modelFactory as linearVariantDisplayModelFactory,
} from './LinearVariantDisplay'
import StructuralVariantChordRendererFactory from './StructuralVariantChordRenderer'
import {
  configSchema as variantFeatureWidgetConfigSchema,
  stateModelFactory as variantFeatureWidgetStateModelFactory,
} from './VariantFeatureWidget'
import { configSchema as vcfTabixAdapterConfigSchema } from './VcfTabixAdapter'
import { configSchema as vcfAdapterConfigSchema } from './VcfAdapter'

export default class VariantsPlugin extends Plugin {
  name = 'VariantsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'VcfTabixAdapter',
          configSchema: vcfTabixAdapterConfigSchema,
          getAdapterClass: () =>
            import('./VcfTabixAdapter/VcfTabixAdapter').then(r => r.default),
        }),
    )

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'VcfAdapter',
          configSchema: vcfAdapterConfigSchema,
          getAdapterClass: () =>
            import('./VcfAdapter/VcfAdapter').then(r => r.default),
        }),
    )

    pluginManager.addRendererType(() =>
      pluginManager.jbrequire(StructuralVariantChordRendererFactory),
    )
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'VariantTrack',
        {},
        { baseConfiguration: createBaseTrackConfig(pluginManager) },
      )
      return new TrackType({
        name: 'VariantTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'VariantTrack',
          configSchema,
        ),
      })
    })

    pluginManager.addDisplayType(() =>
      pluginManager.jbrequire(ChordVariantDisplay),
    )

    pluginManager.addDisplayType(() => {
      const configSchema = linearVariantDisplayConfigSchemaFactory(
        pluginManager,
      )
      return new DisplayType({
        name: 'LinearVariantDisplay',
        configSchema,
        stateModel: linearVariantDisplayModelFactory(configSchema),
        trackType: 'VariantTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })

    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'VariantFeatureWidget',
          heading: 'Feature details',
          configSchema: variantFeatureWidgetConfigSchema,
          stateModel: variantFeatureWidgetStateModelFactory(pluginManager),
          ReactComponent: lazy(
            () => import('./VariantFeatureWidget/VariantFeatureWidget'),
          ),
        }),
    )
  }
}

export { default as VcfFeature } from './VcfTabixAdapter/VcfFeature'
