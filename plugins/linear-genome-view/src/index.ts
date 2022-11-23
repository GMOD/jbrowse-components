import { when } from 'mobx'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

// icons
import LineStyleIcon from '@mui/icons-material/LineStyle'

import {
  BaseLinearDisplay,
  BaseLinearDisplayComponent,
  baseLinearDisplayConfigSchema,
  BlockModel,
} from './BaseLinearDisplay'
import LinearBareDisplayF, {
  configSchemaFactory as linearBareDisplayConfigSchemaFactory,
} from './LinearBareDisplay'
import LinearGenomeViewF, {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
  renderToSvg,
  RefNameAutocomplete,
  SearchBox,
  ZoomControls,
  LinearGenomeView,
} from './LinearGenomeView'

import LinearBasicDisplayF, {
  configSchema as linearBasicDisplayConfigSchemaFactory,
  modelFactory as linearBasicDisplayModelFactory,
} from './LinearBasicDisplay'

import FeatureTrackF from './FeatureTrack'
import BasicTrackF from './BasicTrack'

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
    FeatureTrackF(pluginManager)
    BasicTrackF(pluginManager)
    LinearBasicDisplayF(pluginManager)
    LinearGenomeViewF(pluginManager)
    LinearBareDisplayF(pluginManager)

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
