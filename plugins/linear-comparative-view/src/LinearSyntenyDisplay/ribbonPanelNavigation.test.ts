import { mapSpanAcrossBlock } from './ribbonPanelNavigation.ts'

// A block that is the same length on both axes, so an interpolated position is
// exact and the arithmetic is readable.
const fwd = {
  source: { start: 1000, end: 2000 },
  target: { start: 5000, end: 6000 },
  strand: 1,
}

test('maps a window across a forward block', () => {
  expect(
    mapSpanAcrossBlock({ ...fwd, region: { start: 1200, end: 1400 } }),
  ).toEqual({ start: 5200, end: 5400 })
})

test('maps a window across a reverse block, ends unswapped', () => {
  expect(
    mapSpanAcrossBlock({
      ...fwd,
      strand: -1,
      region: { start: 1200, end: 1400 },
    }),
  ).toEqual({ start: 5600, end: 5800 })
})

test('clamps a window wider than the block to the block itself', () => {
  expect(
    mapSpanAcrossBlock({ ...fwd, region: { start: 0, end: 999999 } }),
  ).toEqual({ start: 5000, end: 6000 })
})

test('scales when the two axes are different lengths', () => {
  expect(
    mapSpanAcrossBlock({
      source: { start: 0, end: 100 },
      target: { start: 0, end: 200 },
      strand: 1,
      region: { start: 25, end: 50 },
    }),
  ).toEqual({ start: 50, end: 100 })
})

// The two menu items are the same function with its span arguments swapped, so
// a round trip has to land back where it started -- on a reverse block above
// all, where the naive inverse is the one that comes out mirrored.
test('is invertible, which is what lets one function move either panel', () => {
  for (const strand of [1, -1]) {
    const region = { start: 1200, end: 1400 }
    const there = mapSpanAcrossBlock({ ...fwd, strand, region })
    const back = mapSpanAcrossBlock({
      source: fwd.target,
      target: fwd.source,
      strand,
      region: there,
    })
    expect(back).toEqual(region)
  }
})

test('a zero-length source axis collapses to the target start', () => {
  expect(
    mapSpanAcrossBlock({
      source: { start: 100, end: 100 },
      target: { start: 500, end: 900 },
      strand: 1,
      region: { start: 100, end: 100 },
    }),
  ).toEqual({ start: 500, end: 500 })
})
