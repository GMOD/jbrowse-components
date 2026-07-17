import { trackBoxHeight } from '@jbrowse/plugin-linear-genome-view'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type Track = LinearGenomeViewModel['tracks'][number]

// Takes an already-minimized-filtered track list so the overlay offsets stay in
// sync with the rendered track bodies.
export function getTrackOffsets(
  tracks: Track[],
  textOffset: number,
  baseY = 0,
) {
  const offsets: Record<string, number> = {}
  let curr = textOffset
  for (const track of tracks) {
    offsets[track.configuration.trackId] = curr + baseY
    // trackBoxHeight (height + textOffset + trackSpacing) must match
    // SVGTracks.getOffsets, or overlay connections drift from the rendered
    // track positions by trackSpacing per track
    curr += trackBoxHeight(track, textOffset)
  }
  return offsets
}
