import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { getSyntenyTracks, resolveRowTrackAction } from '@jbrowse/synteny-core'
import { toJS } from 'mobx'

import type { LinearSyntenyViewModel } from '../../model.ts'

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
      const pairAssemblies = [
        selectedAssemblyNames[idx]!,
        selectedAssemblyNames[idx + 1]!,
      ]
      const action = resolveRowTrackAction(
        model.importFormSyntenyTrackSelections[idx],
        getSyntenyTracks(session.tracks, pairAssemblies),
        pairAssemblies,
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
