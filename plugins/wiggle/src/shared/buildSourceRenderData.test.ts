import { DEFAULT_GAP_BREAK_MULTIPLE } from '@jbrowse/wiggle-core'

import { processFeaturesFromArrays } from '../util.ts'
import { buildSourceRenderData } from './buildSourceRenderData.ts'

import type { WiggleDataResult } from '../util.ts'
import type { WiggleGpuProps } from './buildSourceRenderData.ts'

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
  negColor: '#e01e26',
  summaryScoreMode: 'avg',
  renderingType: 'xyplot',
  isDensityMode: false,
  bicolorPivot: 0,
  maxGapMultiple: DEFAULT_GAP_BREAK_MULTIPLE,
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
  // (no solid color set). In filled xyplot each band is split by sign so the two
  // sides stack back-to-front independently: positive max..avg..min, then
  // negative min..avg..max (most-negative/lightest at the back). The one positive
  // feature (avg 5) and one negative feature (avg -5) yield a single value per
  // side per band.
  test('whiskers mode splits each band by sign for stacking (xyplot)', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryScoreMode: 'whiskers',
    })
    expect(out.map(s => [...s.featureScores])).toEqual([
      [9], // pos max
      [5], // pos avg
      [2], // pos min
      [-8], // neg min (deepest, drawn first/back)
      [-5], // neg avg
      [-1], // neg max (drawn last/front, near pivot)
    ])
  })

  // Line rendering does not overpaint, so bands stay whole (3 layers spanning
  // both signs) and are colored per instance instead of being split.
  test('whiskers mode keeps whole bands for line rendering', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryScoreMode: 'whiskers',
      renderingType: 'line',
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

describe('buildSourceRenderData source list', () => {
  // The display's visible list is the only thing iterated. It filtering to
  // empty (a subtree filter naming no present source) means "draw nothing";
  // falling back to the payload's sources there painted the first one
  // full-height under the "no subtracks match" message.
  test('an empty visible list encodes nothing', () => {
    expect(
      buildSourceRenderData(makeData(), {
        ...baseGpuProps,
        sources: [],
      }),
    ).toEqual([])
  })

  // A source the payload doesn't carry still occupies its row, so the rows
  // below it don't shift up onto data that isn't theirs.
  test('a source missing from the payload keeps its row index', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      sources: [{ name: 'absent' }, { name: 'default' }],
    })
    expect(out.map(s => s.rowIndex)).toEqual([1, 1])
  })
})

// The interpolated line is the only rendering that connects across bins, so it
// is the only one that needs a hole threshold. Computed once per layer here so
// the Canvas2D draw and the GPU instance encoding read the same number rather
// than each deriving one.
describe('buildSourceRenderData gapLimitBp', () => {
  // 3 features 10bp wide starting every 100bp: centers 5, 105, 205, so the mean
  // center spacing is 100 and the default multiple puts the limit at 500.
  function spacedData(): WiggleDataResult {
    const arrays = processFeaturesFromArrays(
      {
        starts: new Int32Array([0, 100, 200]),
        ends: new Int32Array([10, 110, 210]),
        scores: new Float32Array([1, 2, 3]),
        minScores: undefined,
        maxScores: undefined,
        count: 3,
      },
      0,
    )
    return { sources: [{ name: 'default', ...arrays }] }
  }

  test('set from the mean point spacing for linecenter', () => {
    const [layer] = buildSourceRenderData(spacedData(), {
      ...baseGpuProps,
      renderingType: 'linecenter',
    })
    expect(layer!.gapLimitBp).toBe(100 * DEFAULT_GAP_BREAK_MULTIPLE)
  })

  test('left unset for renderings that never bridge bins', () => {
    for (const renderingType of ['xyplot', 'line', 'scatter', 'density']) {
      const [layer] = buildSourceRenderData(spacedData(), {
        ...baseGpuProps,
        renderingType,
        isDensityMode: renderingType === 'density',
      })
      expect(layer!.gapLimitBp).toBeUndefined()
    }
  })

  test('maxGapMultiple 0 keeps one connected line', () => {
    const [layer] = buildSourceRenderData(spacedData(), {
      ...baseGpuProps,
      renderingType: 'linecenter',
      maxGapMultiple: 0,
    })
    expect(layer!.gapLimitBp).toBe(Number.POSITIVE_INFINITY)
  })
})
