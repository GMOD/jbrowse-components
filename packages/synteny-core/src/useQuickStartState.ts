import { useState } from 'react'

import { allSessionTracks } from '@jbrowse/core/util/tracks'

import { pickSyntenyTrackId } from './getSyntenyTracks.ts'
import {
  quickStartSyntenyTracks,
  syntenyTrackRows,
} from './syntenyTrackRows.ts'

import type { ImportFormMode } from './ImportFormModeToggle.tsx'
import type { SessionAssemblies } from '@jbrowse/core/util/tracks'

/**
 * The Quick start / Manual mode state shared by the linear synteny and dotplot
 * import forms: which pre-configured synteny track is picked, and the assembly
 * rows it implies.
 *
 * A synteny track answers in either direction, so the row order it implies is a
 * starting point the user can flip, not a property of the track — hence `swap`.
 * The flag is held here rather than by each form, so the two can't disagree
 * about whether Swap is on, but *what* it flips is the form's own business:
 * synteny reverses the whole stack (`rows`), while a dotplot transposes the one
 * pair it shows and so reads `trackRows` + `swapped` through
 * `dotplotAxesFromRows`. Reversing the stack is not the same operation once a
 * track names more than two assemblies.
 *
 * The opening mode is Quick start when there is a launchable track and Manual
 * otherwise, so an empty session opens on the form that can actually do
 * something. Only the opening mode is a snapshot: which track is picked resolves
 * against the current list on every render, so a track list that grows after
 * mount (a connection finishing its load) can't leave the picker holding an id
 * that isn't in it, showing a blank Select over a Launch that silently opens
 * nothing.
 */
export function useQuickStartState(
  // the session, not a track list: the tracks and the manager that screens them
  // have to come from the same one, and every caller has it in hand
  session: Parameters<typeof allSessionTracks>[0] & {
    assemblyManager: SessionAssemblies
  },
) {
  const quickTracks = quickStartSyntenyTracks(
    allSessionTracks(session),
    session.assemblyManager,
  )
  const [mode, setMode] = useState<ImportFormMode>(
    quickTracks.length ? 'quick' : 'manual',
  )
  const [preferredTrackId, setTrackId] = useState('')
  const [swapped, setSwapped] = useState(false)

  const trackId = pickSyntenyTrackId(preferredTrackId, quickTracks) ?? ''
  const track = quickTracks.find(t => t.trackId === trackId)
  const trackRows = track
    ? syntenyTrackRows(track, session.assemblyManager)
    : []

  return {
    quickTracks,
    mode,
    setMode,
    trackId,
    setTrackId,
    track,
    /** the track's own assembly order, before Swap */
    trackRows,
    swapped,
    /** `trackRows` in the order the form should present them */
    rows: swapped ? [...trackRows].reverse() : trackRows,
    swap: () => {
      setSwapped(!swapped)
    },
  }
}
