import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { getSyntenyTracks, pickSyntenyTrackId } from '@jbrowse/synteny-core'
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
      const selection = model.importFormSyntenyTrackSelections[idx]
      if (selection?.type === 'userOpened' && selection.value !== undefined) {
        session.addTrackConf(toJS(selection.value))
        model.toggleTrack(selection.value.trackId, idx)
      } else if (!selection || selection.type === 'preConfigured') {
        // tracklist default (undefined or preConfigured): show the picked track
        // if still valid for this pair, else the first available
        const picked = selection?.type === 'preConfigured' ? selection.value : ''
        const trackId = pickSyntenyTrackId(
          picked,
          getSyntenyTracks(session.tracks, [
            selectedAssemblyNames[idx]!,
            selectedAssemblyNames[idx + 1]!,
          ]),
        )
        if (trackId) {
          model.showTrack(trackId, idx)
        }
      }
    }
  }
  if (model.levels.length >= 4) {
    model.autoScaleLevelHeights()
  }
  model.clearImportFormSyntenyTracks()
}
