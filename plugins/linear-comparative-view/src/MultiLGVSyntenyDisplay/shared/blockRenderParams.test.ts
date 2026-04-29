import { makeContentBlock } from '@jbrowse/core/util/blockTypes'

import { computeBlockRenderParams } from './blockRenderParams.ts'

describe('computeBlockRenderParams', () => {
  test('returns correct params for block', () => {
    const block = makeContentBlock({
      refName: 'chr1',
      start: 150000000,
      end: 160000000,
      assemblyName: 'test',
      key: 'k1',
      offsetPx: 1000,
      widthPx: 500,
    })
    const params = computeBlockRenderParams(block, 200)
    expect(params.bpRangeLen).toBe(10000000)
    expect(params.regionScreenLeft).toBe(800)
    expect(params.regionScreenWidth).toBe(500)
  })

  test('HP splits region start into hi/lo components', () => {
    const block = makeContentBlock({
      refName: 'chr1',
      start: 150000000,
      end: 160000000,
      assemblyName: 'test',
      key: 'k1',
      offsetPx: 0,
      widthPx: 500,
    })
    const params = computeBlockRenderParams(block, 0)

    const reconstructed = params.bpRangeHi + params.bpRangeLo
    expect(reconstructed).toBe(150000000)

    expect(params.bpRangeHi % 4096).toBe(0)
    expect(params.bpRangeLo).toBeLessThan(4096)
    expect(params.bpRangeLo).toBeGreaterThanOrEqual(0)
  })
})
