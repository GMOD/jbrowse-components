import { sum } from '@jbrowse/core/util'

import type { TrackLabelMode } from '../types.ts'

interface Display {
  height: number
}
interface Track {
  displays: Display[]
}

export const trackSpacing = 2

// space the label pushes a track down by; only 'offset' mode does
export function labelOffset(trackLabels: TrackLabelMode, textHeight: number) {
  return trackLabels === 'offset' ? textHeight : 0
}

// vertical box a single track occupies. Shared by totalHeight (sum) and
// SVGTracks.getOffsets (prefix-sum) so the two can't drift.
export function trackBoxHeight(track: Track, textOffset: number) {
  return track.displays[0]!.height + textOffset + trackSpacing
}

export function totalHeight(
  tracks: Track[],
  textHeight: number,
  trackLabels: TrackLabelMode,
) {
  const textOffset = labelOffset(trackLabels, textHeight)
  return sum(tracks.map(t => trackBoxHeight(t, textOffset)))
}
