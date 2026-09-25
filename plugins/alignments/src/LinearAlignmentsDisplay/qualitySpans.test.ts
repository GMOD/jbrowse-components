import { makePileupDataResult } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { READ_COLOR_CATEGORY } from './colorUtils.ts'
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

const { mapq, mapqUnavailable, supplementary } = READ_COLOR_CATEGORY

test('the MAPQ extent spans only the reads the ramp paints', () => {
  const groups = byGroup(
    {
      readMapqs: Uint8Array.of(12, 255, 70),
      readColorCategories: Uint8Array.of(mapq, mapqUnavailable, supplementary),
    },
    {
      readMapqs: Uint8Array.of(3, 45),
      readColorCategories: Uint8Array.of(mapq, mapq),
    },
  )
  expect(mapqExtentAcrossGroups(groups)).toEqual([3, 45])
})

test('no ramp-painted read is no MAPQ extent', () => {
  const groups = byGroup({
    readMapqs: Uint8Array.of(255),
    readColorCategories: Uint8Array.of(mapqUnavailable),
  })
  expect(mapqExtentAcrossGroups(groups)).toBeUndefined()
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
