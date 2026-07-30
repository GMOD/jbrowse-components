import { isSessionWithAddTracks } from '@jbrowse/core/util'
import {
  allSessionTracks,
  resolveSyntenyTrackActions,
} from '@jbrowse/synteny-core'
import { toJS } from 'mobx'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function doSubmit({
  selectedAssemblyNames,
  model,
  session,
}: {
  selectedAssemblyNames: string[]
  model: LinearSyntenyViewModel
  session: AbstractSessionModel
}) {
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
    // level i draws between rows i and i+1, which is the pair index the actions
    // are keyed by
    const actions = resolveSyntenyTrackActions({
      tracks: allSessionTracks(session),
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: selectedAssemblyNames,
    })
    for (const [level, action] of actions.entries()) {
      if (action?.kind === 'open') {
        session.addTrackConf(toJS(action.conf))
        // showTrack, not toggleTrack: setViews above rebuilt the levels with no
        // tracks on them, so a toggle only ever meant "show" here — and would
        // silently hide the track if that ever stopped being true
        model.showTrack(action.conf.trackId, level)
      } else if (action?.kind === 'show') {
        model.showTrack(action.trackId, level)
      }
    }
  }
  // no-op for few levels (per-level height is capped at the 100px default), so
  // safe to always run; only shrinks bands once the stack gets tall
  model.autoScaleLevelHeights()
  model.clearImportFormSyntenyTracks()
}
