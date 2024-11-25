import { notEmpty } from '@jbrowse/core/util'
import { when } from 'mobx'

// locals
import type { LinearSyntenyViewModel } from './LinearSyntenyView/model'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

type LSV = LinearSyntenyViewModel

interface ViewData {
  loc: string
  assembly: string
  tracks?: string[]
}

type MaybeString = string | undefined

function makeMultiDimArray(str: string[] | string[][]) {
  return Array.isArray(str[0]) ? (str as string[][]) : ([str] as string[][])
}

export default function LaunchLinearSyntenyView(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'LaunchView-LinearSyntenyView',
    // @ts-expect-error
    async ({
      session,
      views,
      tracks = [],
    }: {
      session: AbstractSessionModel
      views: ViewData[]
      tracks?: string[] | string[][]
    }) => {
      try {
        const { assemblyManager } = session
        const model = session.addView('LinearSyntenyView', {}) as LSV

        await when(() => !!model.width)

        model.setViews(
          await Promise.all(
            views.map(async view => {
              const asm = await assemblyManager.waitForAssembly(view.assembly)
              if (!asm) {
                throw new Error(`Assembly ${view.assembly} failed to load`)
              }
              return {
                type: 'LinearGenomeView' as const,
                bpPerPx: 1,
                offsetPx: 0,
                hideHeader: true,
                displayedRegions: asm.regions,
              }
            }),
          ),
        )

        await Promise.all(model.views.map(view => when(() => view.initialized)))

        let idsNotFound = [] as MaybeString[]
        await Promise.all(
          views.map(async (data, idx) => {
            const view = model.views[idx]!
            const { assembly, loc, tracks = [] } = data
            const asm = await assemblyManager.waitForAssembly(assembly)
            if (!asm) {
              throw new Error(`Assembly ${data.assembly} failed to load`)
            }
            await view.navToSearchString({ input: loc, assembly: asm })
            idsNotFound = [
              ...idsNotFound,
              ...tracks.map(trackId =>
                tryTrackLGV({
                  model: view,
                  trackId,
                }),
              ),
            ]
          }),
        )

        idsNotFound = [
          ...idsNotFound,
          ...makeMultiDimArray(tracks).flatMap((trackSet, level) =>
            trackSet.map(trackId =>
              tryTrackSynteny({
                model,
                trackId,
                level,
              }),
            ),
          ),
        ]

        if (idsNotFound.filter(notEmpty).length) {
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

function tryTrackLGV({
  model,
  trackId,
}: {
  model: {
    showTrack: (arg: string) => void
  }
  trackId: string
}) {
  try {
    model.showTrack(trackId)
  } catch (e) {
    if (
      /Could not resolve identifier/.exec(`${e}`) ||
      /track not found/.exec(`${e}`)
    ) {
      return trackId
    } else {
      throw e
    }
  }
  return undefined
}

function tryTrackSynteny({
  model,
  trackId,
  level,
}: {
  model: {
    showTrack: (arg: string, level?: number) => void
  }
  trackId: string
  level: number
}) {
  try {
    model.showTrack(trackId, level)
  } catch (e) {
    if (
      /Could not resolve identifier/.exec(`${e}`) ||
      /track not found/.exec(`${e}`)
    ) {
      return trackId
    } else {
      throw e
    }
  }
  return undefined
}
