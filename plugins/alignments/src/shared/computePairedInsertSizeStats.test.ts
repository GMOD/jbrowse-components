import {
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { computePairedInsertSizeStats } from './computePairedInsertSizeStats.ts'

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
