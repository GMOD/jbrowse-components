import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, when } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '../LinearGenomeView'

type LGV = LinearGenomeViewModel

export default (pluginManager: PluginManager) => {
  pluginManager.addToExtensionPoint(
    'LaunchView-LinearGenomeView',
    // @ts-expect-error
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

        await view.navToLocString(loc, assembly)

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
