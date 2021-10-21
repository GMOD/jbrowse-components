import {
  configSchema as baseFeatureWidgetConfigSchema,
  ReactComponent as BaseFeatureWidgetReactComponent,
  stateModelFactory as baseFeatureWidgetStateModelFactory,
} from '@jbrowse/core/BaseFeatureWidget'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import LineStyleIcon from '@material-ui/icons/LineStyle'
import {
  BaseLinearDisplay,
  BaseLinearDisplayComponent,
  baseLinearDisplayConfigSchema,
  BlockModel,
} from './BaseLinearDisplay'
import {
  configSchemaFactory as linearBareDisplayConfigSchemaFactory,
  stateModelFactory as LinearBareDisplayStateModelFactory,
} from './LinearBareDisplay'
import {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
  ReactComponent as LinearGenomeViewReactComponent,
  stateModelFactory as linearGenomeViewStateModelFactory,
} from './LinearGenomeView'
import { BigsiQueryRPC } from './BigsiQueryRPC/rpcMethods'

import {
  configSchema as linearBasicDisplayConfigSchemaFactory,
  modelFactory as linearBasicDisplayModelFactory,
} from './LinearBasicDisplay'

export default class LinearGenomeViewPlugin extends Plugin {
  name = 'LinearGenomeViewPlugin'

  exports = {
    BaseLinearDisplayComponent,
    BaseLinearDisplay,
    baseLinearDisplayConfigSchema,
  }

  install(pluginManager: PluginManager) {
    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'FeatureTrack',
        {},
        {
          baseConfiguration: createBaseTrackConfig(pluginManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name: 'FeatureTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'FeatureTrack',
          configSchema,
        ),
      })
    })

    pluginManager.addTrackType(() => {
      const configSchema = ConfigurationSchema(
        'BasicTrack',
        {},
        {
          baseConfiguration: createBaseTrackConfig(pluginManager),
          explicitIdentifier: 'trackId',
        },
      )
      return new TrackType({
        name: 'BasicTrack',
        configSchema,
        stateModel: createBaseTrackModel(
          pluginManager,
          'BasicTrack',
          configSchema,
        ),
      })
    })

    pluginManager.addDisplayType(() => {
      const configSchema = linearBareDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearBareDisplay',
        configSchema,
        stateModel: LinearBareDisplayStateModelFactory(configSchema),
        trackType: 'BasicTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })

    pluginManager.addDisplayType(() => {
      const configSchema = linearBasicDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearBasicDisplay',
        configSchema,
        stateModel: linearBasicDisplayModelFactory(configSchema),
        trackType: 'FeatureTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
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
          heading: 'Run refined sequence search',
          configSchema: baseFeatureWidgetConfigSchema,
          stateModel: baseFeatureWidgetStateModelFactory(pluginManager),
          ReactComponent: BaseFeatureWidgetReactComponent,
        }),
    )

    pluginManager.addRpcMethod(() => new BigsiQueryRPC(pluginManager))
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
  BaseLinearDisplayComponent,
  BaseLinearDisplay,
  baseLinearDisplayConfigSchema,
  linearBareDisplayConfigSchemaFactory,
  linearBasicDisplayConfigSchemaFactory,
  linearBasicDisplayModelFactory,
}

export type { LinearGenomeViewModel, LinearGenomeViewStateModel, BlockModel }

export type { BaseLinearDisplayModel } from './BaseLinearDisplay'
