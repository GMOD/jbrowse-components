import { set1 } from '@jbrowse/core/ui/colors'

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
    perSource: false,
  })
})

test('one source in a shared plot keeps the pair, several take a colour each', () => {
  expect(makeDisplay(['a'], false).wiggleColor.perSource).toBe(false)
  expect(makeDisplay(['a', 'b'], false).wiggleColor.perSource).toBe(true)
})

test('a written colour wins over the layout, whatever it is', () => {
  const display = makeDisplay(['a', 'b'], false)
  display.setColor('green')
  expect(display.wiggleColor.perSource).toBe(false)
  expect(display.wiggleColor.posColor).toBe('green')
})

// The circular view's key reads this member off whatever display a ring is
// (`CircularLegendSource`), so a rename here empties the key rather than
// failing a build there.
test('the circular key reads the colour the plot paints', () => {
  const display = makeDisplay(['a'], true)
  expect(display.legendColor).toBe(WIGGLE_POS_COLOR_DEFAULT)
  display.setColor('green')
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

  display.setColor({
    field: 'score',
    scale: 'threshold',
    domain: ['2'],
    range: ['#2166ac', '#b2182b'],
  })
  const key = display.colorScales.find(s => s.id === 'threshold')
  expect(key?.kind).toBe('categorical')
  expect(key?.kind === 'categorical' && key.entries).toEqual([
    { value: '< 2', label: '< 2', color: '#2166ac' },
    { value: '\u2265 2', label: '\u2265 2', color: '#b2182b' },
  ])
})

test('the spec reads back what was written', () => {
  const display = makeDisplay(['a'], true)
  display.setColor({
    field: 'score',
    scale: 'linear',
    scheme: 'viridis',
    reverse: true,
  })
  expect(display.channelSpec.color).toEqual({
    field: 'score',
    scale: 'linear',
    scheme: 'viridis',
    reverse: true,
  })
  display.setColor('green')
  expect(display.channelSpec.color).toBe('green')
})

test('the colour reads the display’s two fields and refuses any other', () => {
  const display = makeDisplay(['a'], true)
  expect(() => {
    display.setColor({ field: 'pvalue', scale: 'threshold' })
  }).toThrow()
})

test('categorical reads source alone, so over score it paints grey', () => {
  const display = makeDisplay(['a', 'b'], false)
  display.setColor({ field: 'score', scale: 'categorical' })
  expect(display.wiggleColor).toMatchObject({
    posColor: '#808080',
    negColor: '#808080',
    perSource: false,
  })
})

test('threshold reads score alone, so over source it paints grey and keys nothing', () => {
  const display = makeDisplay(['a'], true)
  display.setColor({ field: 'source', scale: 'threshold', domain: ['2'] })
  expect(display.wiggleColor).toMatchObject({
    posColor: '#808080',
    negColor: '#808080',
    perSource: false,
  })
  expect(display.colorScales.map(s => s.id)).not.toContain('threshold')
})

test('a colour per source hands out its range, the domain’s sources first', () => {
  const display = makeDisplay(['a', 'b', 'c'], false)
  display.setColor({ field: 'source', range: ['#ff0000', '#0000ff'] })
  const colors = () => display.sources.map(s => s.color)
  expect(colors()).toEqual(['#ff0000', '#0000ff', set1[0]])
  display.setColor({
    field: 'source',
    domain: ['c'],
    range: ['#ff0000', '#0000ff'],
  })
  expect(colors()).toEqual(['#0000ff', set1[0], '#ff0000'])
})

test('a threshold paints a band per cut, sorted as every threshold scale sorts them', () => {
  const display = makeDisplay(['a'], true)
  display.setColor({
    field: 'score',
    scale: 'threshold',
    domain: ['5', '2'],
    range: ['blue', 'grey', 'red'],
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

test('a threshold cut moves the colour, and the bars still grow from the origin', () => {
  const display = makeDisplay(['a'], true)
  display.setColor({ field: 'score', scale: 'threshold', domain: ['2'] })
  const state = makeWiggleRenderState(display, {
    width: 100,
    height: 50,
    numRows: 1,
  })
  expect([state.origin, state.pivot]).toEqual([0, 2])
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

test.each(['xyplot', 'scatter'])(
  'a gradient on %s keys its ramp, into the export too, and keeps the axis',
  renderingType => {
    const display = scoredDisplay([{ name: 'a' }])
    display.setRenderingType(renderingType)
    display.setColor(viridis)
    expect(display.domain).toBeDefined()
    expect(scoreKey(display)?.kind).toBe('ramp')
    expect(display.legendSpec.sections?.map(s => s.id)).toContain('score')
    expect(display.valueScales).toHaveLength(1)
    expect(display.notices).toEqual([])
  },
)

test.each([
  ['the default pair', undefined],
  ['a threshold', { field: 'score', scale: 'threshold', domain: ['2'] }],
  ['a solid colour', 'green'],
] as const)('%s on xyplot draws no gradient key', (_name, color) => {
  const display = scoredDisplay([{ name: 'a' }])
  if (color !== undefined) {
    display.setColor(color)
  }
  expect(display.domain).toBeDefined()
  expect(scoreKey(display)).toBeUndefined()
  expect(display.scoreGradientPaints).toBe(false)
})

test('a colour per source on xyplot draws no gradient key', () => {
  const display = scoredDisplay([{ name: 'a' }, { name: 'b' }])
  display.setRowLayout(false)
  expect(display.wiggleColor.perSource).toBe(true)
  expect(display.domain).toBeDefined()
  expect(scoreKey(display)).toBeUndefined()
})

test('density keeps its key: the fade is keyed until a row brings its own colour', () => {
  const display = scoredDisplay([{ name: 'a' }])
  display.setRenderingType('density')
  expect(scoreKey(display)?.kind).toBe('ramp')
  expect(display.valueScales).toEqual([])
  const coloured = scoredDisplay([{ name: 'a', color: '#ff0000' }])
  coloured.setRenderingType('density')
  expect(scoreKey(coloured)).toBeUndefined()
})

// The gradient's one table ignores a row's own colour, so the key still
// describes every row, and the row's colour moves to its label.
test('a gradient keys its ramp over rows with their own colours, which move to the label', () => {
  const display = scoredDisplay([
    { name: 'a', color: '#ff0000' },
    { name: 'b', color: '#0000ff' },
  ])
  expect(scoreKey(display)).toBeUndefined()
  expect(display.sources.map(s => s.labelColor)).toEqual([undefined, undefined])
  display.setColor(viridis)
  expect(scoreKey(display)?.kind).toBe('ramp')
  expect(display.sources.map(s => s.labelColor)).toEqual(['#ff0000', '#0000ff'])
})

test('a gradient on a line keys nothing and says why', () => {
  const display = scoredDisplay([{ name: 'a' }])
  display.setRenderingType('line')
  display.setColor(viridis)
  expect(scoreKey(display)).toBeUndefined()
  expect(display.scoreGradientPaints).toBe(false)
  expect(display.notices).toEqual([
    'color.scale: a gradient colours bars, points and density; a line paints its two end colours',
  ])
})
