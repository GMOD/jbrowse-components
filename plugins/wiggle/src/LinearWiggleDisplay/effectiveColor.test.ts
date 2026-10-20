import { makeWiggleRenderState } from '../shared/wiggleComponentUtils.ts'
import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import { createTestEnvironment, makeSource } from './testEnv.ts'

function makeDisplay(names: string[], faceted: boolean) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setRowLayout(faceted)
  display.setRpcData(
    0,
    { sources: names.map(n => makeSource(n)) },
    view.displayedRegions[0],
  )
  return display
}

test('a row per source defaults to the pos/neg pair about the origin', () => {
  const display = makeDisplay(['a', 'b'], true)
  expect(display.effectiveColor.field).toBe('score')
  expect(display.wiggleColor).toEqual({
    posColor: WIGGLE_POS_COLOR_DEFAULT,
    negColor: WIGGLE_NEG_COLOR_DEFAULT,
    pivot: 0,
    cuts: [0],
    innerColors: [],
    rampLut: null,
  })
})

// A bare color object is score, so a scale written without the field paints
// score through it, where the pair used to swallow it.
test('a bare color writing a scale paints score through it', () => {
  const display = makeDisplay(['a'], true)
  display.applyPlot({ color: { scale: 'linear', scheme: 'viridis' } })
  expect(display.colorEncoding).toMatchObject({
    field: 'score',
    scale: 'linear',
    scheme: 'viridis',
  })
})

// The display judges the color as `jbrowse validate` does, through the
// schema's implied field, and a written constant is not score.
test("the plot's notices read a bare color as score and a constant as no field", () => {
  const display = makeDisplay(['a'], true)
  expect(display.plotProblems({ color: { domain: ['2', '1'] } })).toEqual([
    expect.stringMatching(/^color\.domain: threshold cuts/),
  ])
  expect(
    display.plotProblems({ color: { value: 'red', domain: ['2', '1'] } }),
  ).toEqual([])
})

test('one source in a shared plot keeps the pair, several take a color each', () => {
  expect(makeDisplay(['a'], false).rowPaletteDeals).toBe(false)
  expect(makeDisplay(['a', 'b'], false).rowPaletteDeals).toBe(true)
})

test('a written color wins over the layout, whatever it is', () => {
  const display = makeDisplay(['a', 'b'], false)
  display.applyPlot({ color: 'green' })
  expect(display.rowPaletteDeals).toBe(false)
  expect(display.wiggleColor.posColor).toBe('green')
})

// The circular view's key reads this member off whatever display a ring is
// (`CircularLegendSource`), so a rename here empties the key rather than
// failing a build there.
test('the circular key reads the color the plot paints', () => {
  const display = makeDisplay(['a'], true)
  expect(display.legendColor).toBe(WIGGLE_POS_COLOR_DEFAULT)
  display.applyPlot({ color: 'green' })
  expect(display.legendColor).toBe('green')
})

test('the origin moves the cut a threshold with no domain reads', () => {
  const display = makeDisplay(['a'], true)
  display.setOrigin(4)
  expect(display.wiggleColor.pivot).toBe(4)
})

test('a declared threshold draws a key, the layout default draws none', () => {
  const display = makeDisplay(['a'], true)
  expect(display.colorScales.map(s => s.id)).not.toContain('threshold')

  display.applyPlot({
    color: {
      field: 'score',
      scale: 'threshold',
      domain: ['2'],
      range: ['#2166ac', '#b2182b'],
    },
  })
  const key = display.colorScales.find(s => s.id === 'threshold')
  expect(key?.kind).toBe('categorical')
  expect(key?.kind === 'categorical' && key.entries).toEqual([
    { value: '< 2', label: '< 2', color: '#2166ac' },
    { value: '\u2265 2', label: '\u2265 2', color: '#b2182b' },
  ])
})

test('the plot reads back what was written', () => {
  const display = makeDisplay(['a'], true)
  display.applyPlot({
    color: {
      field: 'score',
      scale: 'linear',
      scheme: 'viridis',
      reverse: true,
    },
  })
  expect(display.plot.color).toEqual({
    field: 'score',
    scale: 'linear',
    scheme: 'viridis',
    reverse: true,
  })
  display.applyPlot({ color: 'green' })
  expect(display.plot.color).toBe('green')
})

// A subtrack's color is `rowColor`'s, so `source` is no color field and
// `categorical` no color scale here.
test('the color reads score alone and refuses any other field or a categorical scale', () => {
  const display = makeDisplay(['a'], true)
  for (const color of [
    { field: 'pvalue', scale: 'threshold' },
    { field: 'source' },
    { field: 'score', scale: 'categorical' },
  ] as const) {
    expect(() => {
      display.applyPlot({ color })
    }).toThrow()
  }
})

test("a threshold key takes color's title and a label per interval", () => {
  const display = makeDisplay(['a'], true)
  display.applyPlot({
    color: {
      field: 'score',
      scale: 'threshold',
      domain: ['2'],
      range: ['#2166ac', '#b2182b'],
      labels: ['loss'],
      title: 'log2 ratio',
    },
  })
  const key = display.colorScales.find(s => s.id === 'threshold')
  expect(key?.title).toBe('log2 ratio')
  expect(key?.kind === 'categorical' && key.entries.map(e => e.label)).toEqual([
    'loss',
    '≥ 2',
  ])
})

test('a threshold paints a band per cut, sorted as every threshold scale sorts them', () => {
  const display = makeDisplay(['a'], true)
  display.applyPlot({
    color: {
      field: 'score',
      scale: 'threshold',
      domain: ['5', '2'],
      range: ['blue', 'grey', 'red'],
    },
  })
  expect(display.wiggleColor.cuts).toEqual([2, 5])
  const key = display.colorScales.find(s => s.id === 'threshold')
  expect(
    key?.kind === 'categorical' && key.entries.map(e => [e.label, e.color]),
  ).toEqual([
    ['< 2', 'blue'],
    ['2 – 5', 'grey'],
    ['≥ 5', 'red'],
  ])
})

test('a threshold cut moves the color, and the bars still grow from the origin', () => {
  const display = makeDisplay(['a'], true)
  display.applyPlot({
    color: { field: 'score', scale: 'threshold', domain: ['2'] },
  })
  const state = makeWiggleRenderState(display, {
    width: 100,
    height: 50,
    numRows: 1,
  })
  expect([state.origin, state.cuts[0]]).toEqual([0, 2])
})

test('a threshold range that does not fit its cuts is a notice', () => {
  const { createDisplay } = createTestEnvironment({
    displayConfig: {
      color: {
        field: 'score',
        scale: 'threshold',
        domain: ['0', '2'],
        range: ['red', 'blue'],
      },
    },
  })
  expect(createDisplay().display.notices).toEqual([
    expect.stringMatching(/^color\.range: 2 threshold cuts make 3 intervals/),
  ])
})

// A display with a domain, which a ramp key needs.
function scoredDisplay(sources: { name: string; color?: string }[]) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setRowLayout(true)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  display.setRpcData(
    0,
    {
      sources: sources.map(s => ({
        ...s,
        featurePositions: new Uint32Array([0, 1000]),
        featureScores: new Float32Array([30]),
        featureMinScores: new Float32Array([30]),
        featureMaxScores: new Float32Array([30]),
        numFeatures: 1,
        hasSummaryScores: false,
      })),
    },
    view.displayedRegions[0],
  )
  return display
}

const scoreKey = (display: ReturnType<typeof scoredDisplay>) =>
  display.colorScales.find(s => s.id === 'score')

const viridis = { field: 'score', scale: 'linear', scheme: 'viridis' } as const

test.each(['bar', 'point'] as const)(
  'a gradient on %s keys its ramp, into the export too, and keeps the axis',
  mark => {
    const display = scoredDisplay([{ name: 'a' }])
    display.setMark(mark)
    display.applyPlot({ color: viridis })
    expect(display.domain).toBeDefined()
    expect(scoreKey(display)?.kind).toBe('ramp')
    expect(display.legendSpec.sections.map(s => s.id)).toContain('score')
    expect(display.valueScales).toHaveLength(1)
    expect(display.notices).toEqual([])
  },
)

test.each([
  ['the default pair', undefined],
  ['a threshold', { field: 'score', scale: 'threshold', domain: ['2'] }],
  ['a solid color', 'green'],
] as const)('%s on xyplot draws no gradient key', (_name, color) => {
  const display = scoredDisplay([{ name: 'a' }])
  if (color !== undefined) {
    display.applyPlot({ color })
  }
  expect(display.domain).toBeDefined()
  expect(scoreKey(display)).toBeUndefined()
  expect(display.scoreGradientPaints).toBe(false)
})

test('a color per source on xyplot draws no gradient key', () => {
  const display = scoredDisplay([{ name: 'a' }, { name: 'b' }])
  display.setRowLayout(false)
  expect(display.rowPaletteDeals).toBe(true)
  expect(display.domain).toBeDefined()
  expect(scoreKey(display)).toBeUndefined()
})

// A heatmap's unset color is its ramp, which no row's own color replaces, so
// the key describes every row.
test('a heatmap keys its ramp, rows with their own colors included', () => {
  const display = scoredDisplay([{ name: 'a' }])
  display.setMark('span')
  expect(scoreKey(display)?.kind).toBe('ramp')
  expect(display.valueScales).toEqual([])
  const colored = scoredDisplay([{ name: 'a', color: '#ff0000' }])
  colored.setMark('span')
  expect(scoreKey(colored)?.kind).toBe('ramp')
  expect(colored.markSources[0]!.color).toBeUndefined()
})

// The gradient's one table ignores a row's own color, so the key still
// describes every row, and the row's color stays on its label bar.
test('a gradient keys its ramp over rows with their own colors, which keep their label bars', () => {
  const display = scoredDisplay([
    { name: 'a', color: '#ff0000' },
    { name: 'b', color: '#0000ff' },
  ])
  expect(scoreKey(display)).toBeUndefined()
  expect(display.rowColorPaintsMarks).toBe(true)
  expect(display.sources.map(s => s.rowColor)).toEqual(['#ff0000', '#0000ff'])
  display.applyPlot({ color: viridis })
  expect(scoreKey(display)?.kind).toBe('ramp')
  expect(display.rowColorPaintsMarks).toBe(false)
  expect(display.sources.map(s => s.rowColor)).toEqual(['#ff0000', '#0000ff'])
})

// A line reads the ramp along itself, so it keys the ramp as bars do.
test('a gradient on a line keys its ramp and raises no notice', () => {
  const display = scoredDisplay([{ name: 'a' }])
  display.setMark('line')
  display.applyPlot({ color: viridis })
  expect(scoreKey(display)?.kind).toBe('ramp')
  expect(display.scoreGradientPaints).toBe(true)
  expect(display.notices).toEqual([])
})

test("the corner notice reads scales.y's ends by the color ramp's rule", () => {
  const { display } = createTestEnvironment({
    displayConfig: { scales: { y: { domainQuantile: 99 } } },
  }).createDisplay()
  expect(display.notices).toEqual([
    'scales.y.domainQuantile: domainQuantile is a fraction from 0.5 to 1, not a percent: 1 follows the extremes and 0.99 clips the outermost 1% at each end; above 1 reads as 1 and below 0.5 as 0.5',
  ])
})

// With no scale, the pair about the origin is one setting each mark draws its
// own way: bars as a threshold, a heatmap as a ramp through white at the
// origin. A written scale keeps its meaning on a heatmap too.
describe('a heatmap reads the pair as a fade and a written scale as written', () => {
  const heatmap = (color?: string | Record<string, unknown>) => {
    const display = makeDisplay(['a'], true)
    display.setMark('span')
    if (color !== undefined) {
      display.applyPlot({ color })
    }
    return display
  }

  test.each([
    ['unset', undefined],
    ['the field alone', { field: 'score' }],
  ])('%s fades from white at the origin to the defaults', (_, color) => {
    expect(heatmap(color).colorEncoding).toMatchObject({
      scale: 'linear',
      range: [WIGGLE_NEG_COLOR_DEFAULT, '#ffffff', WIGGLE_POS_COLOR_DEFAULT],
      domainMid: 0,
    })
  })

  test('a two-color range fades to its colors, white following the origin', () => {
    const display = heatmap({ range: ['#2166ac', '#b2182b'] })
    display.setOrigin(2)
    expect(display.colorEncoding).toMatchObject({
      scale: 'linear',
      range: ['#2166ac', '#ffffff', '#b2182b'],
      domainMid: 2,
    })
    display.setMark('bar')
    expect(display.colorEncoding).toMatchObject({ scale: 'threshold' })
  })

  test('a written threshold paints solid bands, without the field', () => {
    const display = heatmap({
      scale: 'threshold',
      domain: ['1', '3'],
      range: ['#000', '#888', '#fff'],
    })
    expect(display.colorEncoding).toMatchObject({ scale: 'threshold' })
    expect(display.wiggleColor.rampLut).toBeNull()
  })

  test('a scheme without a scale is that ramp, not the pair', () => {
    expect(heatmap({ scheme: 'viridis' }).colorEncoding).toMatchObject({
      scale: 'linear',
      scheme: 'viridis',
    })
  })

  test('one color paints the heatmap flat and says so', () => {
    const display = heatmap('green')
    expect(display.wiggleColor.rampLut).toBeNull()
    expect(display.configProblemsOf(display.configuration).join('\n')).toMatch(
      /paints a heatmap flat/,
    )
  })
})
