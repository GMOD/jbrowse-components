import PluginManager from '@jbrowse/core/PluginManager'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import LineStyleIcon from '@material-ui/icons/LineStyle'

import {
  configSchema as baseFeatureWidgetConfigSchema,
  ReactComponent as BaseFeatureWidgetReactComponent,
  stateModel as baseFeatureWidgetStateModel,
} from '@jbrowse/core/BaseFeatureWidget'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
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
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from './LinearGenomeView'

import BaseTrack, {
  BaseTrackConfig,
  BaseTrackStateModel,
} from './BasicTrack/baseTrackModel'
import blockBasedTrackModel, {
  BlockBasedTrackModel,
} from './BasicTrack/blockBasedTrackModel'
import BlockBasedTrack from './BasicTrack/components/BlockBasedTrack'
import { BlockModel } from './BasicTrack/util/serverSideRenderedBlock'

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
        ReactComponent: BlockBasedTrack,
      })
    })

    pluginManager.addTrackType(() => {
      const configSchema = dynamicTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'DynamicTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: dynamicTrackStateModelFactory(configSchema),
        ReactComponent: BlockBasedTrack,
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
        onClick: (session: AbstractSessionModel) => {
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

export type {
  BaseTrackStateModel,
  BlockBasedTrackModel,
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
  BlockModel,
}
