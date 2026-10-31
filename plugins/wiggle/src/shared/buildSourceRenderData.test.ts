import { processFeaturesFromArrays } from '../util.ts'
import { buildSourceRenderData } from './buildSourceRenderData.ts'

import type { WiggleGpuProps } from './buildSourceRenderData.ts'
import type { ResolvedWiggleColor } from './wiggleColor.ts'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

// One feature with positive mean, one with negative mean; each carries diverging
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

const baseColor: ResolvedWiggleColor = {
  posColor: '#0068d1',
  negColor: '#e01e26',
  pivot: 0,
  cuts: [0],
  innerColors: [],
  rampLut: null,
  rampMid: undefined,
}

const baseGpuProps: WiggleGpuProps = {
  sources: [{ name: 'default' }],
  rowLayout: true,
  wiggleColor: baseColor,
  origin: 0,
  summaryField: 'score',
  effectiveExtent: 'none',
  renderingType: 'xyplot',
}

describe('buildSourceRenderData summaryField (bicolor, no solid color)', () => {
  test('mean mode is one layer colored by sign per instance', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryField: 'score',
      effectiveExtent: 'none',
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.featureScores).toEqual(new Float32Array([5, -5]))
    const [above, below] = out[0]!.colorsAbgr!
    expect(above).not.toBe(below)
  })

  // Regression: the min-max bands used to be silently dropped under the default bicolor
  // (no solid color set). In filled xyplot each band is split by sign so the two
  // sides stack back-to-front independently: positive max..mean..min, then
  // negative min..mean..max (most-negative/lightest at the back). The one positive
  // feature (mean 5) and one negative feature (mean -5) yield a single value per
  // side per band.
  test('a min-max extent splits each band by sign for stacking (xyplot)', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryField: 'score',
      effectiveExtent: 'min-max',
    })
    expect(out.map(s => [...s.featureScores])).toEqual([
      [9], // pos max
      [5], // pos mean
      [2], // pos min
      [-8], // neg min (deepest, drawn first/back)
      [-5], // neg mean
      [-1], // neg max (drawn last/front, near pivot)
    ])
  })

  // A line plot draws its range as one band spanning both signs, split at the
  // pivot by the painter rather than here, with the mean stroke on top.
  test.each(['line', 'linecenter'])(
    'a min-max extent is a band and a mean stroke for %s',
    renderingType => {
      const out = buildSourceRenderData(makeData(), {
        ...baseGpuProps,
        summaryField: 'score',
        effectiveExtent: 'min-max',
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
        rowLayout: false,
        summaryField: 'score',
        effectiveExtent: 'min-max',
        renderingType: 'linecenter',
      },
    )
    expect(out.map(l => !!l.band)).toEqual([true, true, false, false])
  })

  // Sources sharing one plot are painted one color each, so a band has one
  // color too. Two of them, because a lone plot in the box is the pos/neg
  // bicolor plot a single-source quantitative track has always drawn.
  test('a band over a shared plot takes the source color on both sides of the pivot', () => {
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
        rowLayout: false,
        summaryField: 'score',
        effectiveExtent: 'min-max',
        renderingType: 'linecenter',
      },
    )
    expect(band!.negColor).toEqual(band!.color)
  })

  // Regression: min/max used to emit one layer in posColor, so a signed track
  // set to Minimum drew its below-pivot features in the positive color. The one
  // band is now colored by its own sign, like every min-max band. A lone filled
  // band needs no split — its pos and neg bars grow away from the pivot in
  // opposite directions and never overlap — so the sign rides on the instance
  // colors and the layer count stays at one.
  test.each(['minScore', 'maxScore'] as const)(
    '%s mode colors its band by sign (xyplot)',
    mode => {
      const out = buildSourceRenderData(makeData(), {
        ...baseGpuProps,
        summaryField: mode,
      })
      expect(out).toHaveLength(1)
      expect([...out[0]!.featureScores]).toEqual(
        mode === 'minScore' ? [2, -8] : [9, -1],
      )
      const colors = out[0]!.colorsAbgr!
      expect(colors[0]).not.toEqual(colors[1])
    },
  )

  // A line plot is one continuous line through every bin whatever the mode,
  // colored by pivot side when drawn: the worker's mean split would leave the
  // positive line chording across every negative stretch.
  test.each([
    ['score', [5, -5]],
    ['minScore', [2, -8]],
    ['maxScore', [9, -1]],
  ] as const)(
    '%s mode on a line plot is one line over every bin',
    (mode, scores) => {
      const out = buildSourceRenderData(makeData(), {
        ...baseGpuProps,
        summaryField: mode,
        renderingType: 'linecenter',
      })
      expect(out.map(s => [...s.featureScores])).toEqual([scores])
      expect(out[0]!.colorsAbgr).toBeUndefined()
      expect(out[0]!.negColor).not.toEqual(out[0]!.color)
    },
  )

  // Under a threshold a heatmap cell paints its band's color, solid, as a bar
  // does, so the band stays whole and colors per instance.
  test('min mode colors each heatmap cell by its band', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryField: 'minScore',
      effectiveExtent: 'none',
      renderingType: 'density',
    })
    expect(out.map(s => [...s.featureScores])).toEqual([[2, -8]])
    const [above, below] = out[0]!.colorsAbgr!
    expect(above).not.toBe(below)
  })

  // An all-positive band (ordinary coverage) has no negative side to draw.
  test('min mode in density emits one layer when the band stays above the pivot', () => {
    const out = buildSourceRenderData(makePositiveData(), {
      ...baseGpuProps,
      summaryField: 'minScore',
      effectiveExtent: 'none',
      renderingType: 'density',
    })
    expect(out).toHaveLength(1)
    expect([...out[0]!.featureScores]).toEqual([2, 4])
  })

  // density has no min-max variant. The model resolves that before this ever
  // sees it (`effectiveExtent`, covered in densityMode.test.ts), so what
  // arrives here is 'none', one band.
  test('density + mean keeps one band', () => {
    const out = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryField: 'score',
      effectiveExtent: 'none',
      renderingType: 'density',
    })
    expect(out).toHaveLength(1)
    expect(out[0]!.featureScores).toEqual(new Float32Array([5, -5]))
  })
})

describe('buildSourceRenderData pos/neg coloring', () => {
  test('faceted: the two sides of the pivot pack distinct colors', () => {
    const [layer] = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryField: 'score',
      effectiveExtent: 'none',
    })
    const [above, below] = layer!.colorsAbgr!
    expect(above).not.toBe(below)
  })

  // Unfaceted, every source collapses onto row 0, and several of them take the
  // source's pos color on the neg side so an overlaid plot stays one color.
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
        summaryField: 'score',
        effectiveExtent: 'none',
        sources: [
          { name: 'default', color: '#00ff00' },
          { name: 'b', color: '#ff00ff' },
        ],
        rowLayout: false,
      },
    )
    expect(layers.map(l => l.rowIndex)).toEqual([0, 0])
    expect(layers.every(l => !l.colorsAbgr)).toBe(true)
  })

  // The y position already shows the sign, so a row's own color paints both
  // sides of the cut, and a row with none paints the pair.
  test('a row per source: a colored row is its color on both sides', () => {
    const [colored, plain] = buildSourceRenderData(
      {
        sources: [
          ...makeData().sources,
          { ...makeData().sources[0]!, name: 'b' },
        ],
      },
      {
        ...baseGpuProps,
        sources: [{ name: 'default', color: '#00ff00' }, { name: 'b' }],
      },
    )
    expect(colored!.colorsAbgr).toBeUndefined()
    const [above, below] = plain!.colorsAbgr!
    expect(above).not.toBe(below)
  })

  // A lone plot in the box is the classic pos/neg picture, whatever the facet
  // says: there is nothing for its color to tell it apart from.
  test('a lone source keeps both pivot colors unfaceted', () => {
    const [layer] = buildSourceRenderData(makeData(), {
      ...baseGpuProps,
      summaryField: 'score',
      effectiveExtent: 'none',
      rowLayout: false,
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
      summaryField: 'score',
      effectiveExtent: 'none',
      sources: [{ name: 'absent' }, { name: 'default' }],
    })
    expect(out.map(s => s.rowIndex)).toEqual([1])
  })
})

describe('buildSourceRenderData gapScore', () => {
  // 3 features 10bp wide starting every 100bp, so no two abut
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

  test('a step line falls to the origin bars grow from', () => {
    const [layer] = buildSourceRenderData(spacedData(), {
      ...baseGpuProps,
      renderingType: 'line',
      origin: 4,
    })
    expect(layer!.gapScore).toBe(4)
  })

  // Canvas2D strokes a gradient line in bands over the scores the layer
  // reaches, gapScore included, so an origin stamped here stretched an
  // interpolated line's 32 bands from 0 to wherever its data sat.
  test('an interpolated line never falls to the origin', () => {
    const [layer] = buildSourceRenderData(spacedData(), {
      ...baseGpuProps,
      renderingType: 'linecenter',
      origin: 4,
    })
    expect(layer!.gapScore).toBeUndefined()
  })

  // The band never falls to the origin, so counting it among the scores the
  // band reaches spread its gradient bands down to a value it never draws
  test("a step line's min-max band never falls to the origin", () => {
    const arrays = processFeaturesFromArrays({
      starts: new Int32Array([0, 100, 200]),
      ends: new Int32Array([10, 110, 210]),
      scores: new Float32Array([105, 105, 105]),
      minScores: new Float32Array([100, 100, 100]),
      maxScores: new Float32Array([110, 110, 110]),
      count: 3,
    })
    const data = { sources: [{ name: 'default', ...arrays }] }
    const [band, line] = buildSourceRenderData(data, {
      ...baseGpuProps,
      renderingType: 'line',
      effectiveExtent: 'min-max',
      origin: 0,
    })
    expect(band!.band).toBeDefined()
    expect(band!.gapScore).toBeUndefined()
    expect(line!.gapScore).toBe(0)
  })
})
