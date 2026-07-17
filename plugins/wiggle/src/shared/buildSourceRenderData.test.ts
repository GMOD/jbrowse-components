import { buildSourceRenderData } from './buildSourceRenderData.ts'
import { processFeaturesFromArrays } from '../util.ts'

import type { WiggleGpuProps } from './buildSourceRenderData.ts'
import type { WiggleDataResult } from '../util.ts'

// One feature with positive avg, one with negative avg; each carries diverging
// min/max so it counts as a real summary feature (whiskers becomes 3 layers).
function makeData(): WiggleDataResult {
  const arrays = processFeaturesFromArrays(
    {
      starts: new Int32Array([0, 10]),
      ends: new Int32Array([10, 20]),
      scores: new Float32Array([5, -5]),
      minScores: new Float32Array([2, -8]),
      maxScores: new Float32Array([9, -1]),
      count: 2,
    },
    0,
  )
  return { sources: [{ name: 'default', ...arrays }] }
}

const baseGpuProps: WiggleGpuProps = {
  sources: [{ name: 'default' }],
  posColor: '#0068d1',
  negColor: '#f0636b',
  summaryScoreMode: 'avg',
  renderingType: 'xyplot',
  isDensityMode: false,
  bicolorPivot: 0,
}

describe('buildSourceRenderData summaryScoreMode (bicolor, no solid color)', () => {
  test('avg mode splits into pos/neg layers', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryScoreMode: 'avg',
    })
    expect(out).toHaveLength(2)
    expect(out[0]!.featureScores).toEqual(new Float32Array([5]))
    expect(out[1]!.featureScores).toEqual(new Float32Array([-5]))
  })

  // Regression: whiskers used to be silently dropped under the default bicolor
  // (no solid color set), rendering only the avg split. It must render its 3
  // min/avg/max layers from the full unsplit arrays regardless of bicolor.
  test('whiskers mode renders 3 layers even without a solid color', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryScoreMode: 'whiskers',
    })
    expect(out).toHaveLength(3)
    expect(out.map(s => [...s.featureScores])).toEqual([
      [9, -1], // max layer
      [5, -5], // avg layer
      [2, -8], // min layer
    ])
  })

  test('min mode renders a single min-score layer', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryScoreMode: 'min',
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.featureScores).toEqual(new Float32Array([2, -8]))
  })

  test('max mode renders a single max-score layer', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryScoreMode: 'max',
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.featureScores).toEqual(new Float32Array([9, -1]))
  })

  // density has no whiskers variant: it falls through to the avg pos/neg split.
  test('density + whiskers falls through to the avg split', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryScoreMode: 'whiskers',
      isDensityMode: true,
      renderingType: 'density',
    })
    expect(out).toHaveLength(2)
    expect(out[0]!.featureScores).toEqual(new Float32Array([5]))
    expect(out[1]!.featureScores).toEqual(new Float32Array([-5]))
  })
})

describe('buildSourceRenderData pos/neg coloring', () => {
  test('non-overlay: pos and neg layers use distinct colors', () => {
    const [pos, neg] = buildSourceRenderData(makeData(), baseGpuProps)
    expect(pos!.color).not.toEqual(neg!.color)
  })

  // overlay collapses every source onto row 0 and colors neg features with the
  // source's pos color so overlapping sources stay visually one color.
  test('overlay: neg layer reuses the pos color and shares row 0', () => {
    const [pos, neg] = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      sources: [{ name: 'default', color: '#00ff00' }],
      renderingType: 'multixyplot',
    })
    expect(pos!.color).toEqual(neg!.color)
    expect(pos!.rowIndex).toBe(0)
    expect(neg!.rowIndex).toBe(0)
  })
})
