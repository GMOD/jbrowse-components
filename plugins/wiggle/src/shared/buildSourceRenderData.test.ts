import { DEFAULT_GAP_BREAK_MULTIPLE } from '@jbrowse/wiggle-core'

import { processFeaturesFromArrays } from '../util.ts'
import { buildSourceRenderData } from './buildSourceRenderData.ts'

import type { WiggleGpuProps } from './buildSourceRenderData.ts'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

// One feature with positive avg, one with negative avg; each carries diverging
// min/max so it counts as a real summary feature.
function makeData(): WiggleDataResult {
  const arrays = processFeaturesFromArrays({
    starts: new Int32Array([0, 10]),
    ends: new Int32Array([10, 20]),
    scores: new Float32Array([5, -5]),
    minScores: new Float32Array([2, -8]),
    maxScores: new Float32Array([9, -1]),
    count: 2,
  })
  return { sources: [{ name: 'default', ...arrays }] }
}

// Two all-positive features, the ordinary coverage shape: nothing crosses the
// pivot, so a sign split has only one side to emit.
function makePositiveData(): WiggleDataResult {
  const arrays = processFeaturesFromArrays({
    starts: new Int32Array([0, 10]),
    ends: new Int32Array([10, 20]),
    scores: new Float32Array([5, 7]),
    minScores: new Float32Array([2, 4]),
    maxScores: new Float32Array([9, 11]),
    count: 2,
  })
  return { sources: [{ name: 'default', ...arrays }] }
}

const baseGpuProps: WiggleGpuProps = {
  sources: [{ name: 'default' }],
  faceted: true,
  posColor: '#0068d1',
  negColor: '#e01e26',
  effectiveSummaryScoreMode: 'avg',
  renderingType: 'xyplot',
  origin: 0,
  maxGapMultiple: DEFAULT_GAP_BREAK_MULTIPLE,
}

describe('buildSourceRenderData summaryScoreMode (bicolor, no solid color)', () => {
  test('avg mode is one layer coloured by sign per instance', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      effectiveSummaryScoreMode: 'avg',
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.featureScores).toEqual(new Float32Array([5, -5]))
    const [above, below] = out[0]!.colorsAbgr!
    expect(above).not.toBe(below)
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
      effectiveSummaryScoreMode: 'whiskers',
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

  // A line plot draws its range as one band spanning both signs, split at the
  // pivot by the painter rather than here, with the mean stroke on top.
  test.each(['line', 'linecenter'])(
    'whiskers mode is a band and a mean stroke for %s',
    renderingType => {
      const out = buildSourceRenderData(makeData(), {
        ...baseGpuProps,
        effectiveSummaryScoreMode: 'whiskers',
        renderingType,
      })
      expect(out.map(s => [...s.featureScores])).toEqual([
        [9, -1], // band max
        [5, -5], // mean
      ])
      expect([...out[0]!.band!.minScores]).toEqual([2, -8])
      expect(out[1]!.band).toBeUndefined()
    },
  )

  // Canvas2D paints in layer order, so every band has to come before every
  // line for overlaid sources to draw their lines over each other's bands.
  test('band layers of every source come before any line', () => {
    const out = buildSourceRenderData(
      {
        sources: [
          ...makeData().sources,
          { ...makeData().sources[0]!, name: 'b' },
        ],
      },
      {
        ...baseGpuProps,
        sources: [{ name: 'default' }, { name: 'b' }],
        faceted: false,
        effectiveSummaryScoreMode: 'whiskers',
        renderingType: 'linecenter',
      },
    )
    expect(out.map(l => !!l.band)).toEqual([true, true, false, false])
  })

  // Sources sharing one plot are painted one colour each, so a band has one
  // colour too. Two of them, because a lone plot in the box is the pos/neg
  // bicolor plot a single-source quantitative track has always drawn.
  test('a band over a shared plot takes the source colour on both sides of the pivot', () => {
    const [band] = buildSourceRenderData(
      {
        sources: [
          ...makeData().sources,
          { ...makeData().sources[0]!, name: 'b' },
        ],
      },
      {
        ...baseGpuProps,
        sources: [
          { name: 'default', color: '#00ff00' },
          { name: 'b', color: '#ff00ff' },
        ],
        faceted: false,
        effectiveSummaryScoreMode: 'whiskers',
        renderingType: 'linecenter',
      },
    )
    expect(band!.negColor).toEqual(band!.color)
  })

  // Regression: min/max used to emit one layer in posColor, so a signed track
  // set to Minimum drew its below-pivot features in the positive color. The one
  // band is now colored by its own sign, like every whiskers band. A lone filled
  // band needs no split — its pos and neg bars grow away from the pivot in
  // opposite directions and never overlap — so the sign rides on the instance
  // colors and the layer count stays at one.
  test.each(['min', 'max'] as const)(
    '%s mode colors its band by sign (xyplot)',
    mode => {
      const out = buildSourceRenderData(makeData(), {
        ...baseGpuProps,
        effectiveSummaryScoreMode: mode,
      })
      expect(out).toHaveLength(1)
      expect([...out[0]!.featureScores]).toEqual(
        mode === 'min' ? [2, -8] : [9, -1],
      )
      const colors = out[0]!.colorsAbgr!
      expect(colors[0]).not.toEqual(colors[1])
    },
  )

  // A line plot is one continuous line through every bin whatever the mode,
  // coloured by pivot side when drawn: the worker's avg split would leave the
  // positive line chording across every negative stretch.
  test.each([
    ['avg', [5, -5]],
    ['min', [2, -8]],
    ['max', [9, -1]],
  ] as const)(
    '%s mode on a line plot is one line over every bin',
    (mode, scores) => {
      const out = buildSourceRenderData(makeData(), {
        ...baseGpuProps,
        effectiveSummaryScoreMode: mode,
        renderingType: 'linecenter',
      })
      expect(out.map(s => [...s.featureScores])).toEqual([scores])
      expect(out[0]!.colorsAbgr).toBeUndefined()
      expect(out[0]!.negColor).not.toEqual(out[0]!.color)
    },
  )

  // Density paints a row from the layer color alone (drawDensity has no
  // per-instance path), so there the band is split into two solid layers.
  test('min mode splits the band into pos/neg layers in density', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      effectiveSummaryScoreMode: 'min',
      renderingType: 'density',
    })
    expect(out.map(s => [...s.featureScores])).toEqual([[2], [-8]])
    expect(out[0]!.color).not.toEqual(out[1]!.color)
    expect(out[0]!.colorsAbgr).toBeUndefined()
  })

  // An all-positive band (ordinary coverage) has no negative side to draw.
  test('min mode in density emits one layer when the band stays above the pivot', () => {
    const out = buildSourceRenderData(makePositiveData(), {
      ...baseGpuProps,
      effectiveSummaryScoreMode: 'min',
      renderingType: 'density',
    })
    expect(out).toHaveLength(1)
    expect([...out[0]!.featureScores]).toEqual([2, 4])
  })

  // density has no whiskers variant. The model resolves that before this ever
  // sees it (`effectiveSummaryScoreMode`, covered in densityMode.test.ts), so
  // what arrives here is 'avg' — and density is the one mode that still needs
  // solid-colour layers, `drawDensity` building one gradient per layer.
  test('density + avg splits into solid pos/neg layers', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      effectiveSummaryScoreMode: 'avg',
      renderingType: 'density',
    })
    expect(out).toHaveLength(2)
    expect(out[0]!.featureScores).toEqual(new Float32Array([5]))
    expect(out[1]!.featureScores).toEqual(new Float32Array([-5]))
  })
})

describe('buildSourceRenderData pos/neg coloring', () => {
  test('faceted: the two sides of the pivot pack distinct colors', () => {
    const [layer] = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      effectiveSummaryScoreMode: 'avg',
    })
    const [above, below] = layer!.colorsAbgr!
    expect(above).not.toBe(below)
  })

  // Unfaceted, every source collapses onto row 0, and several of them take the
  // source's pos colour on the neg side so an overlaid plot stays one colour.
  test('a shared plot: one color on both sides of the pivot, on row 0', () => {
    const layers = buildSourceRenderData(
      {
        sources: [
          ...makeData().sources,
          { ...makeData().sources[0]!, name: 'b' },
        ],
      },
      {
        ...baseGpuProps,
        effectiveSummaryScoreMode: 'avg',
        sources: [
          { name: 'default', color: '#00ff00' },
          { name: 'b', color: '#ff00ff' },
        ],
        faceted: false,
      },
    )
    expect(layers.map(l => l.rowIndex)).toEqual([0, 0])
    expect(layers.every(l => !l.colorsAbgr)).toBe(true)
  })

  // A lone plot in the box is the classic pos/neg picture, whatever the facet
  // says: there is nothing for its colour to tell it apart from.
  test('a lone source keeps both pivot colours unfaceted', () => {
    const [layer] = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      effectiveSummaryScoreMode: 'avg',
      faceted: false,
    })
    const [above, below] = layer!.colorsAbgr!
    expect(above).not.toBe(below)
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
      effectiveSummaryScoreMode: 'avg',
      sources: [{ name: 'absent' }, { name: 'default' }],
    })
    expect(out.map(s => s.rowIndex)).toEqual([1])
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
    const arrays = processFeaturesFromArrays({
      starts: new Int32Array([0, 100, 200]),
      ends: new Int32Array([10, 110, 210]),
      scores: new Float32Array([1, 2, 3]),
      minScores: undefined,
      maxScores: undefined,
      count: 3,
    })
    return { sources: [{ name: 'default', ...arrays }] }
  }

  test('set from the mean point spacing for linecenter', () => {
    const [layer] = buildSourceRenderData(spacedData(), {
      ...baseGpuProps,
      renderingType: 'linecenter',
      // an explicit multiple: the DEFAULT is 0 (never break), so the default
      // path is the test below and this one is what a track that opts in gets
      maxGapMultiple: 20,
    })
    expect(layer!.gapLimitBp).toBe(100 * 20)
  })

  test('the default multiple leaves the line unbroken', () => {
    const [layer] = buildSourceRenderData(spacedData(), {
      ...baseGpuProps,
      renderingType: 'linecenter',
      maxGapMultiple: DEFAULT_GAP_BREAK_MULTIPLE,
    })
    expect(layer!.gapLimitBp).toBe(Number.POSITIVE_INFINITY)
  })

  test('left unset for renderings that never bridge bins', () => {
    for (const renderingType of ['xyplot', 'line', 'scatter', 'density']) {
      const [layer] = buildSourceRenderData(spacedData(), {
        ...baseGpuProps,
        renderingType,
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
