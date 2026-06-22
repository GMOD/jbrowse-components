import { max, measureText } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { trackBoxHeight } from '@jbrowse/plugin-linear-genome-view'

import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getTrackNameMaxLen(
  views: LinearGenomeViewModel[],
  fontSize: number,
  session: AbstractSessionModel,
) {
  return max(
    views.flatMap(view =>
      view.tracks.map(t =>
        measureText(getTrackName(t.configuration, session), fontSize),
      ),
    ),
    0,
  )
}
export function getTrackOffsets(
  view: LinearGenomeViewModel,
  textOffset: number,
  baseY = 0,
) {
  const offsets: Record<string, number> = {}
  let curr = textOffset
  for (const track of view.tracks) {
    offsets[track.configuration.trackId] = curr + baseY
    // trackBoxHeight (height + textOffset + trackSpacing) must match
    // SVGTracks.getOffsets, or overlay connections drift from the rendered
    // track positions by trackSpacing per track
    curr += trackBoxHeight(track, textOffset)
  }
  return offsets
}
