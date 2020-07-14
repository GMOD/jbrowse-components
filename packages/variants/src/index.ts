import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import { lazy } from 'react'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import {
  AdapterClass as VcfTabixAdapterClass,
  configSchema as vcfTabixAdapterConfigSchema,
} from './VcfTabixAdapter'
import {
  configSchema as variantFeatureDrawerWidgetConfigSchema,
  ReactComponent as VariantFeatureDrawerWidgetReactComponent,
  stateModel as variantFeatureDrawerWidgetStateModel,
} from './VariantFeatureDrawerWidget'
import {
  configSchemaFactory as variantTrackConfigSchemaFactory,
  modelFactory as variantTrackModelFactory,
} from './VariantTrack'

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

    pluginManager.addDrawerWidgetType(
      () =>
        new DrawerWidgetType({
          name: 'VariantFeatureDrawerWidget',
          heading: 'Feature Details',
          configSchema: variantFeatureDrawerWidgetConfigSchema,
          stateModel: variantFeatureDrawerWidgetStateModel,
          LazyReactComponent: lazy(
            () => VariantFeatureDrawerWidgetReactComponent,
          ),
        }),
    )
  }
}
