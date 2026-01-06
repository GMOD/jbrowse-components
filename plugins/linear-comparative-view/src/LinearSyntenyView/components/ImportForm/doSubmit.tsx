import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
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
  const { importFormSyntenyTrackSelections } = model

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
    toJS(importFormSyntenyTrackSelections).map((f, idx) => {
      if (f.type === 'userOpened') {
        session.addTrackConf(f.value)
        model.toggleTrack(f.value?.trackId, idx)
      } else if (f.type === 'preConfigured') {
        model.showTrack(f.value, idx)
      }
    })
  }
  model.clearImportFormSyntenyTracks()
}
