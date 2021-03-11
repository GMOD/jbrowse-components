import {
  configSchema as baseFeatureWidgetConfigSchema,
  ReactComponent as BaseFeatureWidgetReactComponent,
  stateModelFactory as baseFeatureWidgetStateModelFactory,
} from '@jbrowse/core/BaseFeatureWidget'
import shortid from 'shortid'
import { when } from 'mobx'
import { getSnapshot } from 'mobx-state-tree'
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
import queryString from 'query-string'
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
          heading: 'Feature details',
          configSchema: baseFeatureWidgetConfigSchema,
          stateModel: baseFeatureWidgetStateModelFactory(pluginManager),
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

    this.initFromLocString(pluginManager)
  }

  async initFromLocString(pluginManager: PluginManager) {
    const { loc, ...rest } = queryString.parse(window.location.search)
    if (pluginManager.rootModel && loc) {
      if (!pluginManager.rootModel.session) {
        // @ts-ignore types are not accurate here, they are stub abstracts
        pluginManager.rootModel.setSession({ name: 'New session' })
      }
      const { session } = pluginManager.rootModel

      // @ts-ignore types are not accurate here, they are stub abstracts
      const { assemblyManager } = session
      // @ts-ignore types are not accurate here, they are stub abstracts
      const view = session.addView('LinearGenomeView', {
        id: shortid(),
        type: 'LinearGenomeView',
      })
      await when(() => {
        return (
          assemblyManager.allPossibleRefNames &&
          assemblyManager.allPossibleRefNames.length
        )
      })
      const assembly = assemblyManager.assemblies[0]
      const region = assembly && assembly.regions && assembly.regions[0]
      // @ts-ignore types are not accurate here, they are stub abstracts
      view.setDisplayedRegions([getSnapshot(region)])
      await when(() => {
        return (
          assemblyManager.allPossibleRefNames &&
          assemblyManager.allPossibleRefNames.length &&
          // @ts-ignore types are not accurate here, they are stub abstracts
          view.initialized
        )
      })
      // @ts-ignore types are not accurate here, they are stub abstracts
      view.navToLocString(loc)
      const pageUrl = `${window.location.href}?${queryString.stringify(rest)}`
      window.history.replaceState({}, '', pageUrl)
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
