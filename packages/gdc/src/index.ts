import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import Plugin from '@gmod/jbrowse-core/Plugin'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import { lazy } from 'react'
import {
  configSchema as ConfigSchema,
  HeadingComponent,
  ReactComponent,
  stateModelFactory as filterDrawerStateModelFactory,
} from './GDCFilterDrawerWidget'

import {
  configSchema as gdcFeatureDrawerWidgetConfigSchema,
  ReactComponent as GDCFeatureDrawerWidgetReactComponent,
  stateModel as gdcFeatureDrawerWidgetStateModel,
} from './GDCFeatureDrawerWidget'
import {
  configSchemaFactory as gdcTrackConfigSchemaFactory,
  modelFactory as gdcTrackModelFactory,
} from './GDCTrack'

import GDCAdapterConfigSchema from './GDCAdapter/configSchema'
import GDCAdapterClassF from './GDCAdapter/GDCAdapter'

export default class extends Plugin {
  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GDCAdapter',
          configSchema: GDCAdapterConfigSchema,
          AdapterClass: GDCAdapterClassF(pluginManager),
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

    pluginManager.addDrawerWidgetType(() => {
      return new DrawerWidgetType({
        name: 'GDCFilterDrawerWidget',
        HeadingComponent,
        configSchema: ConfigSchema,
        stateModel: filterDrawerStateModelFactory(pluginManager),
        LazyReactComponent: lazy(() => ReactComponent),
      })
    })

    pluginManager.addDrawerWidgetType(
      () =>
        new DrawerWidgetType({
          name: 'GDCFeatureDrawerWidget',
          heading: 'Feature Details',
          configSchema: gdcFeatureDrawerWidgetConfigSchema,
          stateModel: gdcFeatureDrawerWidgetStateModel,
          LazyReactComponent: lazy(() => GDCFeatureDrawerWidgetReactComponent),
        }),
    )
  }
}
