import { computeBlockRenderParams } from './blockRenderParams.ts'

import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

function block(overrides: Partial<RenderBlock> = {}): RenderBlock {
  return {
    displayedRegionIndex: 0,
    bpRangeX: [0, 1000],
    screenStartPx: 0,
    screenEndPx: 100,
    reversed: false,
    ...overrides,
  }
}

describe('computeBlockRenderParams', () => {
  test('returns correct params for block', () => {
    const params = computeBlockRenderParams(
      block({
        bpRangeX: [150000000, 160000000],
        screenStartPx: 800,
        screenEndPx: 1300,
      }),
    )
    expect(params.bpRangeLen).toBe(10000000)
    expect(params.regionScreenLeft).toBe(800)
    expect(params.regionScreenWidth).toBe(500)
  })

  test('HP splits region start into hi/lo components', () => {
    const params = computeBlockRenderParams(
      block({
        bpRangeX: [150000000, 160000000],
        screenStartPx: 0,
        screenEndPx: 500,
      }),
    )

    const reconstructed = params.bpRangeHi + params.bpRangeLo
    expect(reconstructed).toBe(150000000)

    expect(params.bpRangeHi % 4096).toBe(0)
    expect(params.bpRangeLo).toBeLessThan(4096)
    expect(params.bpRangeLo).toBeGreaterThanOrEqual(0)
  })
})
