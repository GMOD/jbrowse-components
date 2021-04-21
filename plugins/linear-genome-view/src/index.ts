import {
  configSchema as baseFeatureWidgetConfigSchema,
  ReactComponent as BaseFeatureWidgetReactComponent,
  stateModelFactory as baseFeatureWidgetStateModelFactory,
} from '@jbrowse/core/BaseFeatureWidget'
import shortid from 'shortid'
import { when } from 'mobx'
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
import {
  AbstractRootModel,
  AbstractSessionModel,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
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

function getNewSession(
  rootModel: AbstractRootModel,
  preserve: boolean,
): AbstractSessionModel {
  // will clear out any defaultSession or similar things unless `&preserve=true`
  if (!preserve || !rootModel.session) {
    rootModel.setSession?.({ name: 'New session' })
  }
  return rootModel.session as AbstractSessionModel
}

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

    this.initFromQueryString(pluginManager)
  }

  async initFromQueryString(pluginManager: PluginManager) {
    const { loc, assembly, preserve, ...rest } = queryString.parse(
      window.location.search,
    )
    const { rootModel } = pluginManager

    if (rootModel && loc) {
      try {
        const session = getNewSession(rootModel, !!preserve)

        const { assemblyManager } = session
        const view = (session.addView('LinearGenomeView', {
          id: shortid(),
          type: 'LinearGenomeView',
        }) as unknown) as LinearGenomeViewModel

        await when(() => !!assemblyManager.allPossibleRefNames?.length)

        if (!assembly) {
          throw new Error("URL didn't contain an assembly")
        }

        const normalizedLoc: string = Array.isArray(loc) ? loc[0] : loc
        const normalizedAsm: string = Array.isArray(assembly)
          ? assembly[0]
          : assembly

        if (Array.isArray(loc)) {
          session.notify(`URL contained multiple loc strings, using the first`)
        }
        if (Array.isArray(assembly)) {
          session.notify(
            `URL contained multiple assembly strings, using the first`,
          )
        }
        view.navToLocString(normalizedLoc, normalizedAsm)

        // reparse url querystring after adding view, since the process of
        // adding view and navToLocString updates &session=local- so we want to
        // get that param after these operations and then remove &loc,
        // &assembly, &preserve to allow page refresh
        const {
          loc: unused1,
          assembly: unused2,
          preserve: unused3,
          ...result
        } = queryString.parse(window.location.search)
        window.history.replaceState(
          {},
          '',
          `${window.location.href.split('?')[0]}?${queryString.stringify(
            result,
          )}`,
        )
      } catch (e) {
        console.error(e)
        rootModel.session?.notify(
          `failed to init from query strings: ${e.message}`,
        )
      }
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
