import { BEZIER_CONNECTOR_MAX_REACH_PX } from '@jbrowse/core/util'

import { discordantDipPx } from './discordantDip.ts'

const BANDS = [0, 4, 12, 30, 54, 110, 400, 4000]
const SPANS = [1, 500, 2_000, 20_000, 200_000, 9e6, undefined]

// Ample room, for the cases about the law rather than the cap.
const deep = (bandPx: number, spanBp?: number) =>
  discordantDipPx({ bandPx, roomBelowPx: Number.MAX_SAFE_INTEGER, spanBp })

// The invariant the band scaling alone could not deliver: the dip is drawn from
// the lower read's row, so only the room under THAT row bounds the ink. Scaled by
// the band, a 900 kb event in a 60 px band dipped 56 px from every row, and the
// section's clip cut the apex off any row but the top one.
test('a dip never exceeds the room below the reads it joins', () => {
  for (const bandPx of BANDS) {
    for (const spanBp of SPANS) {
      for (const roomBelowPx of [0, 1, 7, 18, 51, bandPx]) {
        expect(
          discordantDipPx({ bandPx, roomBelowPx, spanBp }),
        ).toBeLessThanOrEqual(roomBelowPx)
      }
    }
  }
})

test('the room, not the band, is what a row low in the band has left', () => {
  // ten rows of 6px: the top row spends the whole 56.4px the law asks for, the
  // bottom row has 6px and spends 6
  const nineHundredKb = { bandPx: 60, spanBp: 900_000 }
  expect(discordantDipPx({ ...nineHundredKb, roomBelowPx: 60 })).toBeCloseTo(
    56.4,
    1,
  )
  expect(discordantDipPx({ ...nineHundredKb, roomBelowPx: 6 })).toBe(6)
})

test('a dip is bounded by the reach the culls pad by, however deep the pileup', () => {
  expect(deep(4000)).toBeLessThanOrEqual(BEZIER_CONNECTOR_MAX_REACH_PX)
})

// Keyed on the endpoints' pixel separation, as it was, one 20 kb event drew 55 px
// deep in a 20 kb view and 7.5 px deep in a 400 kb view. Depth reads off the
// event instead; that it holds through a zoom is pinned end-to-end, on the
// overlay, by 'dips the same depth for one event at every zoom'.
test('depth orders by event size', () => {
  const at = (spanBp: number) => deep(200, spanBp)
  expect(at(2_000)).toBeLessThan(at(20_000))
  expect(at(20_000)).toBeLessThan(at(200_000))
  expect(at(200_000)).toBeLessThan(at(900_000))
})

test('an event with no span at all takes the deepest dip its band allows', () => {
  // interchromosomal, or ends in two assemblies: nothing to measure, and a
  // translocation is the largest rearrangement there is
  expect(deep(200)).toBeGreaterThan(deep(200, 200_000))
  expect(deep(60)).toBeGreaterThan(deep(60, 900_000))
  // the law saturates at a megabase, so a whole-chromosome event ties with it
  expect(deep(200)).toBe(deep(200, 9e6))
})

// A deeper pileup dips deeper for the same event, up to the ceiling. Clamping
// the depth rather than the band would bottom every event past the ceiling out at
// one identical depth, which is the spaghetti a size-keyed depth exists to avoid.
test('the ceiling is on the band, so event size still orders in a deep pileup', () => {
  const at = (spanBp: number) => deep(4000, spanBp)
  expect(at(2_000)).toBeLessThan(at(200_000))
  expect(deep(60, 20_000)).toBeLessThan(deep(200, 20_000))
})

test('a collapsed band dips not at all', () => {
  expect(deep(0, 20_000)).toBe(0)
  expect(deep(-50, 20_000)).toBe(0)
  expect(
    discordantDipPx({ bandPx: 200, roomBelowPx: -5, spanBp: 20_000 }),
  ).toBe(0)
})
