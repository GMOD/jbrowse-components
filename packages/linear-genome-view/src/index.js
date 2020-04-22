import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import ViewType from '@gmod/jbrowse-core/pluggableElementTypes/ViewType'
import DrawerWidgetType from '@gmod/jbrowse-core/pluggableElementTypes/DrawerWidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import { lazy } from 'react'

import {
  configSchema as baseFeatureDrawerWidgetConfigSchema,
  ReactComponent as baseFeatureDrawerWidgetReactComponent,
  stateModel as baseFeatureDrawerWidgetStateModel,
} from '@gmod/jbrowse-core/BaseFeatureDrawerWidget'
import {
  configSchemaFactory as basicTrackConfigSchemaFactory,
  stateModelFactory as basicTrackStateModelFactory,
} from './BasicTrack'
import {
  configSchemaFactory as dynamicTrackConfigSchemaFactory,
  stateModelFactory as dynamicTrackStateModelFactory,
} from './DynamicTrack'
import {
  ReactComponent as LinearGenomeViewReactComponent,
  stateModelFactory as linearGenomeViewStateModelFactory,
} from './LinearGenomeView'

export default class extends Plugin {
  install(pluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = basicTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'BasicTrack',
        configSchema,
        stateModel: basicTrackStateModelFactory(configSchema),
      })
    })

    pluginManager.addTrackType(() => {
      const configSchema = dynamicTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'DynamicTrack',
        configSchema,
        stateModel: dynamicTrackStateModelFactory(configSchema),
      })
    })

    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'LinearGenomeView',
          stateModel: linearGenomeViewStateModelFactory(pluginManager),
          ReactComponent: LinearGenomeViewReactComponent,
        }),
    )
    pluginManager.addDrawerWidgetType(
      () =>
        new DrawerWidgetType({
          name: 'BaseFeatureDrawerWidget',
          heading: 'Feature Details',
          configSchema: baseFeatureDrawerWidgetConfigSchema,
          stateModel: baseFeatureDrawerWidgetStateModel,
          LazyReactComponent: lazy(() => baseFeatureDrawerWidgetReactComponent),
        }),
    )
  }

  configure(pluginManager) {
    if (pluginManager.rootModel && pluginManager.rootModel.menus) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Linear genome view',
        icon: 'line_style',
        onClick: session => {
          session.addView('LinearGenomeView', {})
        },
      })
    }
  }
}

export {
  default as BaseTrack,
  BaseTrackConfig,
} from './BasicTrack/baseTrackModel'
export { default as blockBasedTrackModel } from './BasicTrack/blockBasedTrackModel'
export { default as BlockBasedTrack } from './BasicTrack/components/BlockBasedTrack'
export { basicTrackConfigSchemaFactory, basicTrackStateModelFactory }
