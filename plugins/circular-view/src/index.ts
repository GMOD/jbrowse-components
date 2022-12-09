import { when } from 'mobx'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import DataUsageIcon from '@mui/icons-material/DataUsage'
import {
  CircularViewModel,
  CircularViewStateModel,
} from './CircularView/models/CircularView'
import CircularViewF from './CircularView'

type CGV = CircularViewModel

export default class CircularViewPlugin extends Plugin {
  name = 'CircularViewPlugin'

  install(pluginManager: PluginManager) {
    CircularViewF(pluginManager)

    pluginManager.addToExtensionPoint(
      'LaunchView-CircularView',
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
        const { assemblyManager } = session
        const view = session.addView('CircularView', {}) as CGV

        await when(() => view.initialized)

        if (!assembly) {
          throw new Error(
            'No assembly provided when launching circular genome view',
          )
        }

        const asm = await assemblyManager.waitForAssembly(assembly)
        if (!asm) {
          throw new Error(
            `Assembly "${assembly}" not found when launching circular genome view`,
          )
        }

        view.setDisplayedRegions(asm.regions || [])

        tracks.forEach(track => view.showTrack(track))
      },
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Circular view',
        icon: DataUsageIcon,
        onClick: (session: AbstractSessionModel) => {
          session.addView('CircularView', {})
        },
      })
    }
  }
}

export {
  BaseChordDisplayModel,
  baseChordDisplayConfig,
  BaseChordDisplayComponent,
} from './BaseChordDisplay'

export type { CircularViewModel, CircularViewStateModel }
