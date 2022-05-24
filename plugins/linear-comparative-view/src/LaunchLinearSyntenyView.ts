import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { when } from 'mobx'

type LGV = LinearGenomeViewModel

export default function LaunchLinearSyntenyView(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-LinearSyntenyView',
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
    },
  )
}
