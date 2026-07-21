import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { getSyntenyTracks, resolveRowTrackAction } from '@jbrowse/synteny-core'
import { toJS } from 'mobx'

import type { LinearSyntenyViewModel } from '../../model.ts'

export function doSubmit({
  selectedAssemblyNames,
  model,
}: {
  selectedAssemblyNames: string[]
  model: LinearSyntenyViewModel
}) {
  const session = getSession(model)

  // each row is a LinearGenomeView built from a declarative `init` — its
  // afterAttach autorun loads the assembly regions and shows the whole genome,
  // so we don't wait for assemblies or navigate here (see LinearGenomeView
  // model.ts). Width flows in from the comparative view's width autorun.
  model.setViews(
    selectedAssemblyNames.map(assembly => ({
      type: 'LinearGenomeView' as const,
      hideHeader: true,
      init: { assembly },
    })),
  )
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
