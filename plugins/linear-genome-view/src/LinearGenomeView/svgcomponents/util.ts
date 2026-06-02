import { sum } from '@jbrowse/core/util'

import type { TrackLabelMode } from '../types.ts'

interface Display {
  height: number
}
interface Track {
  displays: Display[]
}

export const trackSpacing = 2

// space the label pushes a track down by; only 'offset' mode does. Shared by
// totalHeight + SVGTracks.getOffsets so the two can't drift.
export function labelOffset(trackLabels: TrackLabelMode, textHeight: number) {
  return trackLabels === 'offset' ? textHeight : 0
}

export function totalHeight(
  tracks: Track[],
  textHeight: number,
  trackLabels: TrackLabelMode,
) {
  return sum(
    tracks.map(
      t =>
        t.displays[0]!.height +
        labelOffset(trackLabels, textHeight) +
        trackSpacing,
    ),
  )
}
