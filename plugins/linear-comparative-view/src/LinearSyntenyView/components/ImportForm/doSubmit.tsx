import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'

import type { LinearSyntenyViewModel } from '../../model'

export async function doSubmit({
  selectedAssemblyNames,
  model,
}: {
  selectedAssemblyNames: string[]
  model: LinearSyntenyViewModel
}) {
  const session = getSession(model)
  const { assemblyManager } = session
  const { preConfiguredSyntenyTracksToShow, userOpenedSyntenyTracksToShow } =
    model

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
    userOpenedSyntenyTracksToShow.map((f, idx) => {
      if (f) {
        session.addTrackConf(f)
        model.toggleTrack(f.trackId, idx)
      }
    })
  }
  preConfiguredSyntenyTracksToShow.map((f, idx) => {
    if (f) {
      model.showTrack(f, idx)
    }
  })
}
