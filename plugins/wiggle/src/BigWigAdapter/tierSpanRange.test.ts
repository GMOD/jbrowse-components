import { BigWig } from '@gmod/bbi'
import { openLocation } from '@jbrowse/core/util/io'

import BigWigAdapter from './BigWigAdapter.ts'
import configSchema from './configSchema.ts'
import { tierSpanRange } from './tierSpanRange.ts'

test('the raw section serves up to half the first level, and the top level has no ceiling', () => {
  expect(tierSpanRange([100, 400, 1600], 10)).toEqual([0, 50])
  expect(tierSpanRange([100, 400, 1600], 50)).toEqual([50, 200])
  expect(tierSpanRange([100, 400, 1600], 199)).toEqual([50, 200])
  expect(tierSpanRange([100, 400, 1600], 200)).toEqual([200, 800])
  expect(tierSpanRange([100, 400, 1600], 5000)).toEqual([800, Infinity])
  expect(tierSpanRange([], 5000)).toEqual([0, Infinity])
})

const MICROARRAY = {
  localPath:
    require.resolve('../../../../test_data/volvox/volvox_microarray.bw'),
  locationType: 'LocalPathLocation' as const,
}

function microarrayAdapter(resolutionMultiplier = 1) {
  return new BigWigAdapter(
    configSchema.create({ bigWigLocation: MICROARRAY, resolutionMultiplier }),
  )
}

class PickingBigWig extends BigWig {
  pick(basesPerSpan: number) {
    return this.getView(1 / basesPerSpan)
  }
}

// The rule is bbi's `getView`, so the range holds exactly where bbi hands
// back the same cached block view, and stops exactly where it does not.
test('the range is where @gmod/bbi picks the same view, over a real header', async () => {
  const bigwig = new PickingBigWig({ filehandle: openLocation(MICROARRAY) })
  const { zoomLevels } = await bigwig.getHeader()
  const levels = zoomLevels.map(z => z.reductionLevel)
  expect(levels).toEqual([3478, 13912, 55648])
  const view = (basesPerSpan: number) => bigwig.pick(basesPerSpan)
  let checked = 0
  for (let span = 1; span < 200_000; span *= 1.3) {
    const [lo, hi] = tierSpanRange(levels, span)
    expect(lo).toBeLessThanOrEqual(span)
    expect(span).toBeLessThan(hi)
    const picked = await view(span)
    expect(await view(lo)).toBe(picked)
    if (hi !== Infinity) {
      expect(await view(hi * (1 - 1e-9))).toBe(picked)
      expect(await view(hi)).not.toBe(picked)
      checked++
    }
  }
  expect(checked).toBeGreaterThan(20)
})

test('the range is in bp/px, scaled back through resolution and the multiplier', async () => {
  expect(await microarrayAdapter().getZoomRange({ bpPerPx: 2000 })).toEqual({
    minBpPerPx: 1739,
    maxBpPerPx: 6956,
  })
  expect(await microarrayAdapter().getZoomRange({ bpPerPx: 1000 })).toEqual({
    minBpPerPx: 512,
    maxBpPerPx: 1739,
  })
  expect(await microarrayAdapter().getZoomRange({ bpPerPx: 100 })).toEqual({
    minBpPerPx: 0,
    maxBpPerPx: 128,
  })
  expect(
    await microarrayAdapter().getZoomRange({ bpPerPx: 8000, resolution: 4 }),
  ).toEqual({ minBpPerPx: 6956, maxBpPerPx: 27824 })
  expect(await microarrayAdapter(2).getZoomRange({ bpPerPx: 1000 })).toEqual({
    minBpPerPx: 869.5,
    maxBpPerPx: 3478,
  })
  expect(await microarrayAdapter().getZoomRange({ bpPerPx: 1e6 })).toEqual({
    minBpPerPx: 27824,
    maxBpPerPx: Infinity,
  })
})
