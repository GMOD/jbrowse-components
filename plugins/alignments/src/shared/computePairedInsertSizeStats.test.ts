import {
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { computePairedInsertSizeStats } from './computePairedInsertSizeStats.ts'
import { classifyInsertSize, getInsertSizeStats } from './insertSizeStats.ts'

import type { FeatureData } from './webglRpcTypes.ts'

const PROPER = SAM_FLAG_PAIRED | SAM_FLAG_PROPER_PAIR

function read(insertSize: number, flags = PROPER): FeatureData {
  return { insertSize, flags } as FeatureData
}

// A spread of inserts wide enough to give a real band.
function spread(n: number) {
  return Array.from({ length: n }, (_, i) => read(300 + (i % 200)))
}

test('pools every group into one band', () => {
  const band = computePairedInsertSizeStats([spread(50), spread(50)])
  expect(band!.lower).toBeGreaterThan(0)
  expect(band!.upper).toBeGreaterThan(band!.lower)
})

test('no proper pairs → no band', () => {
  expect(computePairedInsertSizeStats([])).toBeUndefined()
  expect(computePairedInsertSizeStats([[]])).toBeUndefined()
  expect(
    computePairedInsertSizeStats([[read(500, SAM_FLAG_PAIRED)]]),
  ).toBeUndefined()
})

test('secondary and supplementary reads are excluded from the sample', () => {
  expect(
    computePairedInsertSizeStats([
      [
        ...spread(50),
        read(999_999, PROPER | SAM_FLAG_SECONDARY),
        read(999_999, PROPER | SAM_FLAG_SUPPLEMENTARY),
      ],
    ])!.upper,
  ).toBeLessThan(999_999)
})

// A band with no width classifies every read that is not exactly at the center
// as a long or short outlier, flooding the pileup red/pink. Better to paint
// nothing, as for unpaired data, than to paint that.
describe('degenerate bands are rejected', () => {
  test('a single proper pair', () => {
    expect(computePairedInsertSizeStats([[read(350)]])).toBeUndefined()
  })

  test('several proper pairs that share one TLEN', () => {
    expect(
      computePairedInsertSizeStats([[read(350), read(350), read(350)]]),
    ).toBeUndefined()
  })

  // Enough width to be informative, even though every value is identical bar
  // one — this must still produce a band.
  test('but a sample with any real spread survives', () => {
    expect(
      computePairedInsertSizeStats([[read(350), read(350), read(900)]]),
    ).toBeDefined()
  })
})

// The band is widened to the event scale here and not inside the statistics —
// see LONG_INSERT_MIN_RATIO for the HG002 300x measurements behind it. What
// these pin is the CONSEQUENCE at depth, which is the whole point: a tight
// library sampled deeply must not paint its own right tail long-insert.
describe('the coloring band is floored to the event scale', () => {
  // The measured HG002 300x shape: ~20k proper pairs, median 571, MAD ~94, and
  // a distribution that stops dead at 1141. Synthesized as a discretized normal
  // rather than shipped as a fixture, since the only property under test is
  // that the widest fragment the library actually produces stays 'normal'.
  //
  // PEAKED, not uniform, and that is the whole fixture: MAD is what sets the
  // threshold, so a uniform bulk over the same RANGE has 3x the MAD and a band
  // wide enough to pass this test while proving nothing. sd 140 gives
  // MAD = 0.6745·140 ≈ 94, which is the measured value.
  function tightLibrary() {
    const reads: FeatureData[] = []
    for (let tlen = 1; tlen <= 1141; tlen++) {
      const z = (tlen - 571) / 140
      for (let k = Math.round(60 * Math.exp(-0.5 * z * z)); k > 0; k--) {
        reads.push(read(tlen))
      }
    }
    // The extreme itself: at z = 4.07 its true share rounds to zero copies, and
    // one read at the far edge is exactly the case in question.
    reads.push(read(1141))
    return reads
  }

  test('the raw 3-MAD band would call the library tail long', () => {
    const raw = getInsertSizeStats(
      Int32Array.from(tightLibrary(), r => r.insertSize),
    )
    expect(classifyInsertSize(1141, raw)).toBe('long')
  })

  test('the widened band does not', () => {
    const band = computePairedInsertSizeStats([tightLibrary()])!
    expect(band.upper).toBeGreaterThanOrEqual(1141)
    expect(classifyInsertSize(1141, band)).toBe('normal')
  })

  test('a genuinely discordant pair is still flagged', () => {
    const band = computePairedInsertSizeStats([tightLibrary()])!
    expect(classifyInsertSize(5000, band)).toBe('long')
    expect(classifyInsertSize(1_500_000, band)).toBe('long')
  })

  // A max/min, so the floor only ever widens, and it goes slack exactly when
  // the spread already reaches the centre — a library loose enough that 3
  // robust SDs span the whole fragment size. There the raw band survives
  // untouched.
  test('a band already wider than the ratio is left alone', () => {
    const loose = Array.from({ length: 2000 }, (_, i) => read(100 + (i % 801)))
    const band = computePairedInsertSizeStats([loose])!
    const raw = getInsertSizeStats(Int32Array.from(loose, r => r.insertSize))
    expect(band).toEqual(raw)
  })
})
