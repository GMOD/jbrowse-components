import { cumBpAtGenomicCoord, cumBpInEntry } from './bpRegionIndex.ts'

import type { RegionIndexEntry } from './bpRegionIndex.ts'

function entry(reversed: boolean, bpBefore = 1000): RegionIndexEntry {
  return {
    index: 0,
    region: {
      refName: 'chr1',
      start: 200,
      end: 500,
      assemblyName: 'a',
      reversed,
    },
    bpBefore,
  }
}

// `cumBpInEntry` clamps, `cumBpAtGenomicCoord` is the same map with the clamp
// removed — which is the whole reason the second one exists, so it is stated
// against the first rather than as its own arithmetic.
test('the two agree inside the region and part company outside it', () => {
  for (const reversed of [false, true]) {
    const e = entry(reversed)
    for (const coord of [200, 350, 500]) {
      expect(cumBpAtGenomicCoord(e, coord)).toBe(cumBpInEntry(e, coord))
    }
    expect(cumBpInEntry(e, -1)).toBe(cumBpInEntry(e, 200))
    expect(cumBpAtGenomicCoord(e, -1)).not.toBe(cumBpInEntry(e, -1))
  }
})

// The location-marker grid's phase. `RULER_GRID_ORIGIN` is -1, i.e. outside
// every region, and only `anchor mod pitch` is read — so what this has to get
// right is that stepping cumBp from the anchor lands only on coordinates the
// scalebar draws a gridline at, which are the ones congruent to -1 mod the
// pitch.
//
// Stated as a round trip rather than as a direction, because the direction is
// the thing under test: a reversed region walks the same grid backwards, so
// asserting a signed step would just re-spell the branch. The reversed arm has
// been wrong before — for a grid symmetric about the origin the phase comes out
// the same either way, and the scalebar's is NOT symmetric (it sits one bp below
// each round coordinate), so reversing the axis lands it on the other side.
test('every step off the anchor is a coordinate the ruler draws a line at', () => {
  const pitch = 40
  for (const reversed of [false, true]) {
    const e = entry(reversed)
    const { region, bpBefore } = e
    const anchor = cumBpAtGenomicCoord(e, -1)
    const lo = bpBefore
    const hi = bpBefore + (region.end - region.start)
    let seen = 0
    for (let n = -20; n < 20; n++) {
      const cumBp = anchor + n * pitch
      if (cumBp >= lo && cumBp <= hi) {
        const genomic = reversed
          ? region.end - (cumBp - bpBefore)
          : cumBp - bpBefore + region.start
        expect((genomic + 1) % pitch).toBe(0)
        expect(cumBpInEntry(e, genomic)).toBe(cumBp)
        seen++
      }
    }
    expect(seen).toBeGreaterThan(5)
  }
})

test('a reversed region walks cumBp backwards down the genomic axis', () => {
  const e = entry(true)
  expect(cumBpAtGenomicCoord(e, 200)).toBe(1300)
  expect(cumBpAtGenomicCoord(e, 500)).toBe(1000)
  expect(cumBpAtGenomicCoord(e, -1)).toBe(1501)
})
