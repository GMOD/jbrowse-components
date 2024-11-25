import { max, measureText } from '@jbrowse/core/util'

// locals
import { getTrackName } from '@jbrowse/core/util/tracks'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals

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
  extra = 0,
) {
  const offsets = {} as Record<string, number>
  let curr = textOffset
  for (const track of view.tracks) {
    offsets[track.configuration.trackId] = curr + extra
    curr += track.displays[0].height + textOffset
  }
  return offsets
}
