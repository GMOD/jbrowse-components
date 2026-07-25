import { useState } from 'react'

import {
  quickStartSyntenyTracks,
  syntenyTrackRows,
} from './syntenyTrackRows.ts'

import type { ImportFormMode } from './ImportFormModeToggle.tsx'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * The Quick start / Manual mode state shared by the linear synteny and dotplot
 * import forms: which pre-configured synteny track is picked, and the assembly
 * rows it implies.
 *
 * A synteny track answers in either direction, so the row order it implies is a
 * starting point the user can flip, not a property of the track — hence `swap`.
 * The reversal is applied here rather than by each form, so "swapped" can't mean
 * two different things in two places. The forms differ only in how they present
 * `rows` (a stack for synteny, X/Y axes for dotplot) and what Launch does with
 * them.
 *
 * The opening mode is Quick start when there is a launchable track and Manual
 * otherwise, so an empty session opens on the form that can actually do
 * something.
 */
export function useQuickStartState(tracks: AnyConfigurationModel[]) {
  const quickTracks = quickStartSyntenyTracks(tracks)
  const [mode, setMode] = useState<ImportFormMode>(
    quickTracks.length ? 'quick' : 'manual',
  )
  const [trackId, setTrackId] = useState(quickTracks[0]?.trackId ?? '')
  const [swapped, setSwapped] = useState(false)

  const track = quickTracks.find(t => t.trackId === trackId)
  const trackRows = track ? syntenyTrackRows(track) : []

  return {
    quickTracks,
    mode,
    setMode,
    trackId,
    setTrackId,
    track,
    rows: swapped ? [...trackRows].reverse() : trackRows,
    swap: () => {
      setSwapped(!swapped)
    },
  }
}
