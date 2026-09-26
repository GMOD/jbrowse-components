import { BEZIER_CONNECTOR_MAX_REACH_PX } from '@jbrowse/core/util'

import { discordantDipPx } from './discordantDip.ts'

// The invariant that killed the attempt before this one: a fixed 110 px dip under
// a pileup a few reads deep fell out the bottom of the section's clip, and what
// survived read as a breakend tick rather than a connector.
test('a dip never exceeds the band it is given', () => {
  for (const band of [0, 4, 12, 30, 54, 110, 400, 4000]) {
    for (const spanBp of [1, 500, 2_000, 20_000, 200_000, 9e6, undefined]) {
      expect(discordantDipPx(band, spanBp)).toBeLessThanOrEqual(band)
    }
  }
})

test('a dip is bounded by the reach the culls pad by, however deep the pileup', () => {
  expect(discordantDipPx(4000)).toBeLessThanOrEqual(
    BEZIER_CONNECTOR_MAX_REACH_PX,
  )
})

// Keyed on the endpoints' pixel separation, as it was, one 20 kb event drew 55 px
// deep in a 20 kb view and 7.5 px deep in a 400 kb view. Depth reads off the
// event instead; that it holds through a zoom is pinned end-to-end, on the
// overlay, by 'dips the same depth for one event at every zoom'.
test('depth orders by event size', () => {
  const at = (spanBp: number) => discordantDipPx(200, spanBp)
  expect(at(2_000)).toBeLessThan(at(20_000))
  expect(at(20_000)).toBeLessThan(at(200_000))
  expect(at(200_000)).toBeLessThan(at(900_000))
})

test('an event with no span at all takes the deepest dip its band allows', () => {
  // interchromosomal, or ends in two assemblies: nothing to measure, and a
  // translocation is the largest rearrangement there is
  expect(discordantDipPx(200)).toBeGreaterThan(discordantDipPx(200, 200_000))
  expect(discordantDipPx(60)).toBeGreaterThan(discordantDipPx(60, 900_000))
  // the law saturates at a megabase, so a whole-chromosome event ties with it
  expect(discordantDipPx(200)).toBe(discordantDipPx(200, 9e6))
})

// A deeper pileup dips deeper for the same event, up to the ceiling. Clamping
// the depth rather than the band would bottom every event past the ceiling out at
// one identical depth, which is the spaghetti a size-keyed depth exists to avoid.
test('the ceiling is on the band, so event size still orders in a deep pileup', () => {
  const at = (spanBp: number) => discordantDipPx(4000, spanBp)
  expect(at(2_000)).toBeLessThan(at(200_000))
  expect(discordantDipPx(60, 20_000)).toBeLessThan(discordantDipPx(200, 20_000))
})

test('a collapsed band dips not at all', () => {
  expect(discordantDipPx(0, 20_000)).toBe(0)
  expect(discordantDipPx(-50, 20_000)).toBe(0)
})
