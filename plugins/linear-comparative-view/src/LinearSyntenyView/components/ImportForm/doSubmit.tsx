import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { getSyntenyTracks, pickSyntenyTrackId } from '@jbrowse/synteny-core'
import { toJS } from 'mobx'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

type UserOpened = Extract<ImportFormSyntenyTrack, { type: 'userOpened' }>

type RowTrackAction =
  | { kind: 'open'; conf: NonNullable<UserOpened['value']> }
  | { kind: 'show'; trackId: string }

/**
 * What to do with one row pair's synteny selection: open + show an uploaded
 * track, show a pre-configured one (the pick if still valid for the pair, else
 * the first available), or nothing for an explicit "none".
 */
export function resolveRowTrackAction(
  selection: ImportFormSyntenyTrack | undefined,
  syntenyTracksForPair: AnyConfigurationModel[],
): RowTrackAction | undefined {
  let action: RowTrackAction | undefined
  if (selection?.type === 'userOpened' && selection.value !== undefined) {
    action = { kind: 'open', conf: selection.value }
  } else if (!selection || selection.type === 'preConfigured') {
    const picked = selection?.type === 'preConfigured' ? selection.value : ''
    const trackId = pickSyntenyTrackId(picked, syntenyTracksForPair)
    action = trackId ? { kind: 'show', trackId } : undefined
  }
  return action
}

export async function doSubmit({
  selectedAssemblyNames,
  model,
}: {
  selectedAssemblyNames: string[]
  model: LinearSyntenyViewModel
}) {
  const session = getSession(model)
  const { assemblyManager } = session

  model.setViews(
    await Promise.all(
      selectedAssemblyNames.map(async assemblyName => {
        const asm = await assemblyManager.waitForAssembly(assemblyName)
        if (!asm) {
          throw new Error(`Assembly "${assemblyName}" failed to load`)
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
  for (const view of model.views) {
    view.setWidth(model.width)
    view.showAllRegions()
  }
  if (!isSessionWithAddTracks(session)) {
    session.notify("Can't add tracks", 'warning')
  } else {
    for (let idx = 0; idx < selectedAssemblyNames.length - 1; idx++) {
      const action = resolveRowTrackAction(
        model.importFormSyntenyTrackSelections[idx],
        getSyntenyTracks(session.tracks, [
          selectedAssemblyNames[idx]!,
          selectedAssemblyNames[idx + 1]!,
        ]),
      )
      if (action?.kind === 'open') {
        session.addTrackConf(toJS(action.conf))
        model.toggleTrack(action.conf.trackId, idx)
      } else if (action?.kind === 'show') {
        model.showTrack(action.trackId, idx)
      }
    }
  }
  // no-op for few levels (per-level height is capped at the 100px default), so
  // safe to always run; only shrinks bands once the stack gets tall
  model.autoScaleLevelHeights()
  model.clearImportFormSyntenyTracks()
}
