import { isSessionWithAddSessionTrack } from '@jbrowse/core/util'
import { allSessionTracks } from '@jbrowse/core/util/tracks'
import { toJS } from 'mobx'

import { resolveSyntenyTrackActions } from './resolveRowTrackAction.ts'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'
import type {
  AssemblyHost,
  NotificationSink,
  TrackCatalog,
} from '@jbrowse/core/util'

/**
 * Turn an import form's per-pair selections into open tracks: resolve what each
 * adjacent pair asked for, add any uploaded config to the session, and show the
 * result on the level that draws between those two rows. A dotplot passes its
 * two assemblies and gets the single-pair case.
 *
 * Both import forms submit through here, because resolving and applying are two
 * halves of one answer and splitting them across two files is how they drifted:
 * the dotplot's copy used to `toggleTrack` where the synteny form used
 * `showTrack`, which silently *hid* the track on a re-submit — `addTrackConf`
 * dedupes by trackId, so the second pass reaches a track that is already shown.
 * Showing is idempotent; toggling is only correct on a level known to be empty.
 */
export function applySyntenyTrackSelections({
  session,
  selections,
  assemblyNames,
  showTrack,
}: {
  session: AssemblyHost & NotificationSink & TrackCatalog
  selections: (ImportFormSyntenyTrack | undefined)[]
  /** the form's assembly rows, top to bottom; a dotplot's are [x, y] */
  assemblyNames: string[]
  /** `level` is the pair index: the band between rows `level` and `level + 1` */
  showTrack: (trackId: string, level: number) => void
}) {
  if (!isSessionWithAddSessionTrack(session)) {
    // the pre-configured case would work, but an upload cannot be added, and
    // silently opening the view without the track the user chose is worse than
    // saying so
    session.notify("Can't add tracks", 'warning')
    return
  }
  const actions = resolveSyntenyTrackActions({
    tracks: allSessionTracks(session),
    selections,
    assemblyNames,
    assemblyManager: session.assemblyManager,
  })
  for (const [level, action] of actions.entries()) {
    if (action?.kind === 'open') {
      session.addSessionTrackConf(toJS(action.conf))
      showTrack(action.conf.trackId, level)
    } else if (action?.kind === 'show') {
      showTrack(action.trackId, level)
    }
  }
}
