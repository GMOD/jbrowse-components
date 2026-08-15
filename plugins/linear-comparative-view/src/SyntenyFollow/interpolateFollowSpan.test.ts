import { interpolateFollowSpan } from './interpolateFollowSpan.ts'

import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

function feat({
  strand = 1,
  start = 1000,
  end = 2000,
  mateStart = 5000,
  mateEnd = 6000,
}): FeatPos {
  return {
    id: 'f1',
    name: 'f1',
    strand,
    refName: 'chr1',
    start,
    end,
    assemblyName: 'hg002mat',
    mate: {
      start: mateStart,
      end: mateEnd,
      refName: 'chr1_pat',
      assemblyName: 'hg002pat',
    },
    attributes: {},
  }
}

function win(start: number, end: number): FollowWindow {
  return { refName: 'chr1', start, end }
}

test('a window over the middle of a block lands on the middle of its mate', () => {
  expect(
    interpolateFollowSpan({
      feat: feat({}),
      window: win(1250, 1750),
      toMate: true,
    }),
  ).toEqual({ refName: 'chr1_pat', start: 5250, end: 5750 })
})

test('an unequal block scales the window by the length ratio', () => {
  // 1kb of query against 2kb of target: the follow zooms the moving panel out
  // to match, which is what keeps the ribbons vertical
  expect(
    interpolateFollowSpan({
      feat: feat({ mateStart: 5000, mateEnd: 7000 }),
      window: win(1250, 1750),
      toMate: true,
    }),
  ).toEqual({ refName: 'chr1_pat', start: 5500, end: 6500 })
})

test('a reverse-strand block counts down from the mate far end', () => {
  expect(
    interpolateFollowSpan({
      feat: feat({ strand: -1 }),
      window: win(1250, 1750),
      toMate: true,
    }),
  ).toEqual({ refName: 'chr1_pat', start: 5250, end: 5750 })
})

test('reverse strand puts the window on the opposite half of the mate', () => {
  // the left quarter of the block matches the RIGHT quarter of its mate
  expect(
    interpolateFollowSpan({
      feat: feat({ strand: -1 }),
      window: win(1000, 1250),
      toMate: true,
    }),
  ).toEqual({ refName: 'chr1_pat', start: 5750, end: 6000 })
})

test('a window wider than the block clamps to the block, not past the mate', () => {
  expect(
    interpolateFollowSpan({
      feat: feat({}),
      window: win(0, 100_000),
      toMate: true,
    }),
  ).toEqual({ refName: 'chr1_pat', start: 5000, end: 6000 })
})

test('the reverse direction maps the mate axis back onto the feature', () => {
  expect(
    interpolateFollowSpan({
      feat: feat({}),
      window: win(5250, 5750),
      toMate: false,
    }),
  ).toEqual({ refName: 'chr1', start: 1250, end: 1750 })
})

test('the reverse direction on a reverse-strand block', () => {
  expect(
    interpolateFollowSpan({
      feat: feat({ strand: -1 }),
      window: win(5750, 6000),
      toMate: false,
    }),
  ).toEqual({ refName: 'chr1', start: 1000, end: 1250 })
})

test('the reverse direction clamps to the mate block', () => {
  expect(
    interpolateFollowSpan({
      feat: feat({}),
      window: win(0, 100_000),
      toMate: false,
    }),
  ).toEqual({ refName: 'chr1', start: 1000, end: 2000 })
})

test('a zero-length block resolves to one base rather than an inverted span', () => {
  // assembleLocStringRaw would render an inverted span as a backwards locstring
  const span = interpolateFollowSpan({
    feat: feat({ start: 1000, end: 1000, mateStart: 5000, mateEnd: 5000 }),
    window: win(1000, 1000),
    toMate: true,
  })
  expect(span.end).toBeGreaterThan(span.start)
})
