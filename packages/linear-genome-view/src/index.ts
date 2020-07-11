import PluginManager from '@gmod/jbrowse-core/PluginManager'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import ViewType from '@gmod/jbrowse-core/pluggableElementTypes/ViewType'
import WidgetType from '@gmod/jbrowse-core/pluggableElementTypes/WidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import LineStyleIcon from '@material-ui/icons/LineStyle'
import { lazy } from 'react'

import {
  configSchema as baseFeatureWidgetConfigSchema,
  ReactComponent as baseFeatureWidgetReactComponent,
  stateModel as baseFeatureWidgetStateModel,
} from '@gmod/jbrowse-core/BaseFeatureWidget'
import {
  AbstractViewContainer,
  isAbstractMenuManager,
} from '@gmod/jbrowse-core/util'
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
  install(pluginManager: PluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = basicTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'BasicTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: basicTrackStateModelFactory(configSchema),
      })
    })

    pluginManager.addTrackType(() => {
      const configSchema = dynamicTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'DynamicTrack',
        compatibleView: 'LinearGenomeView',
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
    pluginManager.addWidgetType(
      () =>
        new WidgetType({
          name: 'BaseFeatureWidget',
          heading: 'Feature Details',
          configSchema: baseFeatureWidgetConfigSchema,
          stateModel: baseFeatureWidgetStateModel,
          LazyReactComponent: lazy(() => baseFeatureWidgetReactComponent),
        }),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['File', 'Add'], {
        label: 'Linear genome view',
        icon: LineStyleIcon,
        onClick: (session: AbstractViewContainer) => {
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
