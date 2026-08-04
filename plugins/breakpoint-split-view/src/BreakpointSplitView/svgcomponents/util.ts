import { trackBoxOffsets } from '@jbrowse/plugin-linear-genome-view'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type Track = LinearGenomeViewModel['tracks'][number]

// Top of each of a view's rendered track *bodies*, keyed by trackId, for
// anchoring the overlay ribbons. Takes an already-minimized-filtered track
// list, and shares trackBoxOffsets with SVGTracks (which lays the boxes out
// with it) so the anchors can't drift from the rendered tracks.
//
// `textOffset` is added on top of the box offset for the same reason SVGTracks
// translates the body down by it: in 'offset' label mode the box starts with
// the label band and the features begin below it.
export function getTrackOffsets(
  tracks: Track[],
  textOffset: number,
  baseY = 0,
) {
  const offsets = trackBoxOffsets(tracks, textOffset)
  return Object.fromEntries(
    tracks.map(
      (track, i) =>
        [
          track.configuration.trackId,
          baseY + textOffset + offsets[i]!,
        ] as const,
    ),
  )
}
