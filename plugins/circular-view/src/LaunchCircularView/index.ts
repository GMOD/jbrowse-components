import { when } from 'mobx'
import type { CircularViewModel } from '../CircularView/models/model'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// locals

type CGV = CircularViewModel

export default function LaunchCircularViewF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-CircularView',
    // @ts-expect-error
    async ({
      session,
      assembly,
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

      tracks.forEach(track => {
        view.showTrack(track)
      })
    },
  )
}
