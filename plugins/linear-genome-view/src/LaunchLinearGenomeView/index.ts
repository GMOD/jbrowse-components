import { when, parseLocString } from '@jbrowse/core/util'
import { handleSelectedRegion } from '../searchUtils'
import type { LinearGenomeViewModel } from '../LinearGenomeView'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'
// locals

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
            const p = parseLocString(h, refName =>
              isValidRefName(refName, assembly),
            )
            const { start, end } = p
            if (start !== undefined && end !== undefined) {
              view.addToHighlights({
                ...p,
                start,
                end,
                assemblyName: assembly,
              })
            }
          })
        }

        await handleSelectedRegion({ input: loc, model: view, assembly: asm })

        const idsNotFound = [] as string[]
        tracks.forEach(track => {
          tryTrack(view, track, idsNotFound)
        })
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
    if (/Could not resolve identifier/.exec(`${e}`)) {
      idsNotFound.push(trackId)
    } else {
      throw e
    }
  }
}
