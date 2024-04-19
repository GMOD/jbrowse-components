import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  when,
  parseLocString,
  ParsedLocString,
} from '@jbrowse/core/util'
// locals
import { LinearGenomeViewModel } from '../LinearGenomeView'
import { handleSelectedRegion } from '../searchUtils'

type LGV = LinearGenomeViewModel

export default function LaunchLinearGenomeViewF(pluginManager: PluginManager) {
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
      highlight?: string[]
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

        if (tracklist) {
          view.activateTrackSelector()
        }
        if (nav !== undefined) {
          view.setHideHeader(!nav)
        }
        if (highlight !== undefined) {
          highlight.forEach(async h => {
            if (h) {
              const parsedLocString = parseLocString(h, refName =>
                isValidRefName(refName, assembly),
              ) as Required<ParsedLocString>

              const location = {
                ...parsedLocString,
                assemblyName: assembly,
              }

              if (
                location?.start !== undefined &&
                location?.end !== undefined
              ) {
                view.addToHighlights(location)
              }
            }
          })
        }

        await handleSelectedRegion({ input: loc, model: view, assembly: asm })

        const idsNotFound = [] as string[]
        tracks.forEach(track => tryTrack(view, track, idsNotFound))
        if (idsNotFound.length) {
          throw new Error(
            `Could not resolve identifiers: ${idsNotFound.join(',')}`,
          )
        }
      } catch (e) {
        session.notifyError(`${e}`, e)
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
