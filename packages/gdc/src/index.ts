import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import Plugin from '@gmod/jbrowse-core/Plugin'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import WidgetType from '@gmod/jbrowse-core/pluggableElementTypes/WidgetType'
import { lazy } from 'react'
import {
  configSchema as ConfigSchema,
  HeadingComponent,
  ReactComponent,
  stateModelFactory as filterDrawerStateModelFactory,
} from './GDCFilterWidget'

import {
  configSchema as gdcFeatureWidgetConfigSchema,
  ReactComponent as GDCFeatureWidgetReactComponent,
  stateModel as gdcFeatureWidgetStateModel,
} from './GDCFeatureWidget'
import {
  configSchemaFactory as gdcTrackConfigSchemaFactory,
  modelFactory as gdcTrackModelFactory,
} from './GDCTrack'

import {
  AdapterClass as GDCAdapterClass,
  configSchema as GDCAdapterConfigSchema,
} from './GDCAdapter'

export default class extends Plugin {
  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GDCAdapter',
          configSchema: GDCAdapterConfigSchema,
          AdapterClass: GDCAdapterClass,
        }),
    )

    pluginManager.addTrackType(() => {
      const configSchema = gdcTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'GDCTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: gdcTrackModelFactory(configSchema),
      })
    })

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'GDCFilterWidget',
        HeadingComponent,
        configSchema: ConfigSchema,
        stateModel: filterDrawerStateModelFactory(pluginManager),
        LazyReactComponent: lazy(() => ReactComponent),
      })
    })

    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'GDCFeatureWidget',
          heading: 'Feature Details',
          configSchema: gdcFeatureWidgetConfigSchema,
          stateModel: gdcFeatureWidgetStateModel,
          LazyReactComponent: lazy(() => GDCFeatureWidgetReactComponent),
        }),
    )
  }
}
