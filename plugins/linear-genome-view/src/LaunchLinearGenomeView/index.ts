import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, when, parseLocString } from '@jbrowse/core/util'
// locals
import { LinearGenomeViewModel } from '../LinearGenomeView'
import { handleSelectedRegion } from '../searchUtils'

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
      tracklist,
      nav,
      highlight,
    }: {
      session: AbstractSessionModel
      assembly?: string
      loc: string
      tracks?: string[]
      tracklist?: boolean
      nav?: boolean
      highlight?: string
    }) => {
      try {
        const { assemblyManager } = session

        const { isValidRefName } = assemblyManager

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

        await handleSelectedRegion({ input: loc, model: view, assembly: asm })

        const idsNotFound = [] as string[]
        tracks.forEach(track => tryTrack(view, track, idsNotFound))
        if (idsNotFound.length) {
          throw new Error(
            `Could not resolve identifiers: ${idsNotFound.join(',')}`,
          )
        }
        if (tracklist) {
          view.activateTrackSelector()
        }
        if (nav !== undefined) {
          view.setHideHeader(!nav)
        }
        if (highlight !== undefined) {
          const location = parseLocString(highlight, refName =>
            isValidRefName(refName, assembly),
          )
          if (location?.start && location?.end) {
            location.assemblyName = assembly

            view.setHighlight(location)
          }
        }
      } catch (e) {
        session.notify(`${e}`, 'error')
        throw e
      }
    },
  )
}

function tryTrack(
  model: {
    showTrack: (arg: string) => void
  },
  trackId: string,
  idsNotFound: string[],
) {
  try {
    model.showTrack(trackId)
  } catch (e) {
    if (`${e}`.match('Could not resolve identifier')) {
      idsNotFound.push(trackId)
    } else {
      throw e
    }
  }
}
