import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
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
  configSchemaFactory as gdcTrackConfigSchemaFactory,
  modelFactory as gdcTrackModelFactory,
} from './GDCTrack'

import {
  AdapterClass as GDCAdapterClass,
  configSchema as GDCAdapterConfigSchema,
} from './GDCAdapter'

export default class extends Plugin {
  install(pluginManager) {
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
  }
}
