import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import {
  baseQualitySpanAcrossGroups,
  mapqExtentAcrossGroups,
} from './qualitySpans.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'

function byGroup(...regions: Partial<PileupDataResult>[]) {
  return new Map([
    ['', new Map(regions.map((r, i) => [i, makePileupDataResult(r)] as const))],
  ])
}

test('the MAPQ extent spans every read with one, 255 held out', () => {
  const groups = byGroup(
    { readMapqs: Uint8Array.of(12, 255, 70) },
    { readMapqs: Uint8Array.of(3, 45) },
  )
  expect(mapqExtentAcrossGroups(groups)).toEqual([3, 70])
})

test('reads with no MAPQ are no MAPQ extent', () => {
  expect(
    mapqExtentAcrossGroups(byGroup({ readMapqs: Uint8Array.of(255) })),
  ).toBeUndefined()
})

test('the base-quality span holds 255 out and reports it', () => {
  expect(
    baseQualitySpanAcrossGroups(
      byGroup(
        { perBaseQualScores: Uint8Array.of(2, 41, 255) },
        { perBaseQualScores: Uint8Array.of(30) },
      ),
    ),
  ).toEqual({ extent: [2, 41], unavailable: true })
  expect(
    baseQualitySpanAcrossGroups(
      byGroup({ perBaseQualScores: Uint8Array.of(255, 255) }),
    ),
  ).toEqual({ extent: undefined, unavailable: true })
})
