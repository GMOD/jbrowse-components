import { windowInsideFeat } from './windowInsideFeat.ts'

import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

const WINDOW: FollowWindow = {
  refName: 'chr1',
  start: 1000,
  end: 2000,
}

const feat: FeatPos = {
  id: 'f0',
  name: 'f0',
  strand: 1,
  refName: 'chr1',
  start: 1000,
  end: 2000,
  assemblyName: 'hg002mat',
  mate: {
    start: 5000,
    end: 6000,
    refName: 'chr1_pat',
    assemblyName: 'hg002pat',
  },
  attributes: {},
}

// Each side of the block is the anchor axis in one direction, and neither is
// interchangeable with the other: the frame pass reuses a block across a window
// that has since moved contig, so an answer taken on coordinates alone came from
// an alignment about somewhere else entirely.
test('the query axis when the mate row moves', () => {
  expect(windowInsideFeat(feat, WINDOW, true)).toBe(true)
  expect(windowInsideFeat(feat, { ...WINDOW, refName: 'chr9' }, true)).toBe(
    false,
  )
  // the mate axis' own coordinates, which are not this direction's question
  expect(
    windowInsideFeat(feat, { refName: 'chr1', start: 5100, end: 5200 }, true),
  ).toBe(false)
})

test('the mate axis when the feature row moves', () => {
  const inside = { refName: 'chr1_pat', start: 5100, end: 5200 }
  expect(windowInsideFeat(feat, inside, false)).toBe(true)
  expect(windowInsideFeat(feat, { ...inside, refName: 'chr9' }, false)).toBe(
    false,
  )
})
