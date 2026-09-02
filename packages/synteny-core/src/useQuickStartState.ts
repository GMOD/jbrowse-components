import { useState } from 'react'

import { allSessionTracks } from '@jbrowse/core/util/tracks'

import { pickSyntenyTrackId } from './getSyntenyTracks.ts'
import { syntenyPairs } from './syntenyPairs.ts'
import {
  quickStartSyntenyTracks,
  syntenyTrackRows,
} from './syntenyTrackRows.ts'

import type { ImportFormMode } from './ImportFormModeToggle.tsx'
import type { ImportFormSyntenyModel } from './SelectorTypes.ts'
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
 * The mode is Quick start when there is a launchable track and Manual
 * otherwise, so an empty session shows the form that can actually do something
 * — **derived, not snapshotted at mount**. Nothing about the launchable list is
 * settled on the first render: a connection has not finished loading its
 * tracks, and the assembly models an alias-named track resolves through are not
 * built yet. A session with one connection-supplied dataset is the ordinary
 * hub case, and it opened on Manual and stayed there for the rest of the
 * session — the one mode that cannot launch that dataset in a click. Deriving
 * also keeps Quick start from sitting selected over an empty panel when the
 * last launchable track goes away.
 *
 * A mode the user picks latches, so nothing finishing its load afterwards moves
 * the form under them. What can still move is a form typed into without ever
 * touching the toggle: that flip is Manual → Quick start, it only happens while
 * the session is still filling itself in (so, within a moment of opening), and
 * Manual is one click away with its state intact. That is the better half of
 * the trade against a mode that is wrong for the whole session.
 *
 * Which track is picked resolves against the current list on every render for
 * the same reason, so a list that grows after mount can't leave the picker
 * holding an id that isn't in it, showing a blank Select over a Launch that
 * silently opens nothing.
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
  const [chosenMode, setMode] = useState<ImportFormMode>()
  const mode = chosenMode ?? (quickTracks.length ? 'quick' : 'manual')
  const [preferredTrackId, setPreferredTrackId] = useState('')
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
    // a new track's own order is the starting point again: Swap was an answer
    // about the previous track's pair, not a standing preference
    setTrackId: (next: string) => {
      setPreferredTrackId(next)
      setSwapped(false)
    },
    track,
    /** the track's own assembly order, before Swap */
    trackRows,
    swapped,
    /** `trackRows` in the order the form should present them */
    rows: swapped ? [...trackRows].reverse() : trackRows,
    swap: () => {
      setSwapped(prev => !prev)
    },
  }
}

/**
 * Hand the Quick start track to every adjacent pair the form is about to open:
 * a pairwise track has one pair, an all-vs-all track one per adjacent row, and a
 * dotplot one however many assemblies the track names.
 *
 * The clear is what makes it one rule rather than two: this replaces whatever
 * Manual had configured, and a per-form copy is free to forget that.
 */
export function applyQuickStartSelections(
  model: ImportFormSyntenyModel,
  trackId: string,
  /** the rows the form is about to open; a dotplot's are its two axes */
  rows: string[],
) {
  model.clearImportFormSyntenyTracks()
  for (const [idx] of syntenyPairs(rows).entries()) {
    model.setImportFormSyntenyTrack(idx, {
      type: 'preConfigured',
      value: trackId,
    })
  }
}
