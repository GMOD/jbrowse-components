import { trackBoxHeight } from '@jbrowse/plugin-linear-genome-view'

import { getTrackOffsets } from './util.ts'

// only the fields the offset math reads; the real MST track is a pluggable
// union TS widens to `any`, so a plain object drives this fine
function track(trackId: string, height: number) {
  return { configuration: { trackId }, displays: [{ height }] }
}

const TEXT_OFFSET = 20

test('anchors sit at the top of each rendered track body', () => {
  const tracks = [track('t1', 100), track('t2', 50)]
  const offsets = getTrackOffsets(tracks, TEXT_OFFSET)

  // the first body starts below its own label band, not at the top of its box
  expect(offsets.t1).toBe(TEXT_OFFSET)
  // and each subsequent one a whole box further down. This is the invariant
  // that keeps the overlay ribbons on the tracks: SVGTracks lays the boxes out
  // with the same trackBoxHeight and then translates each body down by
  // textOffset, so anything else drifts by a label band or a track spacing.
  expect(offsets.t2).toBe(TEXT_OFFSET + trackBoxHeight(tracks[0]!, TEXT_OFFSET))
})

test('baseY shifts the whole view, and label-less mode has no band', () => {
  const tracks = [track('t1', 100), track('t2', 50)]
  const offsets = getTrackOffsets(tracks, 0, 500)

  expect(offsets.t1).toBe(500)
  expect(offsets.t2).toBe(500 + trackBoxHeight(tracks[0]!, 0))
})

test('a track absent from the list has no anchor', () => {
  // the export leans on this: a track minimized in any view is filtered out
  // here, and is then skipped rather than anchored at the top of the view
  expect(getTrackOffsets([track('t1', 100)], TEXT_OFFSET).t2).toBeUndefined()
})
