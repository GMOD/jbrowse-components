import { lazy } from 'react'
import { when } from 'mobx'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import Plugin from '@jbrowse/core/Plugin'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import DataUsageIcon from '@material-ui/icons/DataUsage'
import stateModelFactory from './CircularView/models/CircularView'

export default class CircularViewPlugin extends Plugin {
  name = 'CircularViewPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          ReactComponent: lazy(
            () => import('./CircularView/components/CircularView'),
          ),
          stateModel: stateModelFactory(pluginManager),
          name: 'CircularView',
        }),
    )

    pluginManager.addToExtensionPoint(
      'LaunchView-CircularView',
      // @ts-ignore
      async ({
        session,
        assembly,
        loc,
        tracks,
      }: {
        session: AbstractSessionModel
        assembly: string
        loc: string
        tracks?: string[]
      }) => {
        const { assemblyManager } = session
        const view = session?.addView('CircularView', {})

        // @ts-ignore
        await when(() => view.initialized)

        const asm = await assemblyManager.waitForAssembly(assembly)

        // @ts-ignore
        view.setDisplayedRegions(asm.regions)

        tracks?.forEach(track => {
          // @ts-ignore
          view.showTrack(track)
        })
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
  BaseChordDisplayComponentFactory,
} from './BaseChordDisplay'
