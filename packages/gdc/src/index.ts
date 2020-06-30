import type PluginManager from '@gmod/jbrowse-core/PluginManager'
import Plugin from '@gmod/jbrowse-core/Plugin'

import GDCFilterDrawerWidget from './GDCFilterDrawerWidget'
import GDCFeatureDrawerWidgetF from './GDCFeatureDrawerWidget'
import GDCTrack from './GDCTrack'

import GDCAdapterConfigSchema from './GDCAdapter/configSchema'
import GDCAdapterClass from './GDCAdapter/GDCAdapter'

export default class extends Plugin {
  name = 'GDCPlugin'

  install(pluginManager: PluginManager) {
    const AdapterType =
      pluginManager.lib['@gmod/jbrowse-core/pluggableElementTypes/AdapterType']
    const TrackType =
      pluginManager.lib['@gmod/jbrowse-core/pluggableElementTypes/TrackType']
    const DrawerWidgetType =
      pluginManager.lib[
        '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
      ]

    const { lazy } = pluginManager.lib.react
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'GDCAdapter',
          configSchema: GDCAdapterConfigSchema,
          AdapterClass: pluginManager.load(GDCAdapterClass),
        }),
    )

    pluginManager.addTrackType(() => {
      const { configSchema, stateModel } = pluginManager.load(GDCTrack)
      return new TrackType({
        name: 'GDCTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel,
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      const {
        configSchema,
        HeadingComponent,
        ReactComponent,
        stateModel,
      } = pluginManager.load(GDCFilterDrawerWidget)

      return new DrawerWidgetType({
        name: 'GDCFilterDrawerWidget',
        HeadingComponent,
        configSchema,
        stateModel,
        LazyReactComponent: lazy(async () => ReactComponent),
      })
    })

    pluginManager.addDrawerWidgetType(() => {
      const { configSchema, stateModel, ReactComponent } = pluginManager.load(
        GDCFeatureDrawerWidgetF,
      )

      return new DrawerWidgetType({
        name: 'GDCFeatureDrawerWidget',
        heading: 'Feature Details',
        configSchema,
        stateModel,
        LazyReactComponent: lazy(async () => ReactComponent),
      })
    })
  }
}
