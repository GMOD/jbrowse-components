import {
  labelOffset,
  trackBoxOffsets,
} from '@jbrowse/plugin-linear-genome-view'

import type {
  LinearGenomeViewModel,
  TrackLabelMode,
} from '@jbrowse/plugin-linear-genome-view'

type Track = LinearGenomeViewModel['tracks'][number]

// Top of each of a view's rendered track *bodies*, keyed by trackId, for
// anchoring the overlay ribbons. Takes an already-minimized-filtered track
// list, and shares trackBoxOffsets and labelOffset with SVGTracks (which lays
// the boxes out with them) so the anchors can't drift from the rendered tracks:
// in 'offset' label mode a box starts with its label band and the features
// begin below it.
export function getTrackOffsets(
  tracks: Track[],
  trackLabels: TrackLabelMode,
  textHeight: number,
  baseY = 0,
) {
  const offsets = trackBoxOffsets(tracks, trackLabels, textHeight)
  return Object.fromEntries(
    tracks.map(
      (track, i) =>
        [
          track.configuration.trackId,
          baseY + offsets[i]! + labelOffset(track, trackLabels, textHeight),
        ] as const,
    ),
  )
}
