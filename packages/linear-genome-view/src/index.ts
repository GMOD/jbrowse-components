import PluginManager from '@gmod/jbrowse-core/PluginManager'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import ViewType from '@gmod/jbrowse-core/pluggableElementTypes/ViewType'
import WidgetType from '@gmod/jbrowse-core/pluggableElementTypes/WidgetType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import LineStyleIcon from '@material-ui/icons/LineStyle'

import {
  configSchema as baseFeatureWidgetConfigSchema,
  ReactComponent as BaseFeatureWidgetReactComponent,
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

import BaseTrack, { BaseTrackConfig } from './BasicTrack/baseTrackModel'
import blockBasedTrackModel from './BasicTrack/blockBasedTrackModel'
import BlockBasedTrack from './BasicTrack/components/BlockBasedTrack'

export default class LinearGenomeViewPlugin extends Plugin {
  name = 'LinearGenomeViewPlugin'

  exports = {
    BaseTrack,
    BaseTrackConfig,
    blockBasedTrackModel,
    BlockBasedTrack,
    basicTrackConfigSchemaFactory,
    basicTrackStateModelFactory,
  }

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
          ReactComponent: BaseFeatureWidgetReactComponent,
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
  BaseTrack,
  BaseTrackConfig,
  blockBasedTrackModel,
  BlockBasedTrack,
  basicTrackConfigSchemaFactory,
  basicTrackStateModelFactory,
}
