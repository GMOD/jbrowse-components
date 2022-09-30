import { lazy } from 'react'
import { when } from 'mobx'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import LineStyleIcon from '@mui/icons-material/LineStyle'
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
  stateModelFactory as linearGenomeViewStateModelFactory,
  renderToSvg,
  RefNameAutocomplete,
  SearchBox,
  ZoomControls,
  LinearGenomeView,
} from './LinearGenomeView'

import {
  configSchema as linearBasicDisplayConfigSchemaFactory,
  modelFactory as linearBasicDisplayModelFactory,
} from './LinearBasicDisplay'

type LGV = LinearGenomeViewModel

export default class LinearGenomeViewPlugin extends Plugin {
  name = 'LinearGenomeViewPlugin'

  exports = {
    BaseLinearDisplayComponent,
    BaseLinearDisplay,
    baseLinearDisplayConfigSchema,
    SearchBox,
    ZoomControls,
    LinearGenomeView,
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
          ReactComponent: lazy(
            () => import('./LinearGenomeView/components/LinearGenomeView'),
          ),
        }),
    )

    pluginManager.addToExtensionPoint(
      'LaunchView-LinearGenomeView',
      // @ts-ignore
      async ({
        session,
        assembly,
        loc,
        tracks = [],
      }: {
        session: AbstractSessionModel
        assembly?: string
        loc: string
        tracks?: string[]
      }) => {
        try {
          const { assemblyManager } = session
          const view = session.addView('LinearGenomeView', {}) as LGV

          await when(() => !!view.volatileWidth)

          if (!assembly) {
            throw new Error(
              'No assembly provided when launching linear genome view',
            )
          }

          const asm = await assemblyManager.waitForAssembly(assembly)
          if (!asm) {
            throw new Error(
              `Assembly "${assembly}" not found when launching linear genome view`,
            )
          }

          view.navToLocString(loc, assembly)

          const idsNotFound = [] as string[]
          tracks.forEach(track => {
            try {
              view.showTrack(track)
            } catch (e) {
              if (`${e}`.match('Could not resolve identifier')) {
                idsNotFound.push(track)
              } else {
                throw e
              }
            }
          })
          if (idsNotFound.length) {
            throw new Error(
              `Could not resolve identifiers: ${idsNotFound.join(',')}`,
            )
          }
        } catch (e) {
          session.notify(`${e}`, 'error')
          throw e
        }
      },
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
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
  baseLinearDisplayConfigSchema,
  linearBareDisplayConfigSchemaFactory,
  linearBasicDisplayConfigSchemaFactory,
  linearBasicDisplayModelFactory,
  renderToSvg,
  BaseLinearDisplayComponent,
  BaseLinearDisplay,
  RefNameAutocomplete,
  SearchBox,
}

export type { LinearGenomeViewModel, LinearGenomeViewStateModel, BlockModel }

export type { BaseLinearDisplayModel } from './BaseLinearDisplay'
