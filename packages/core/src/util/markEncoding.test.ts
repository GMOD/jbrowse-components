import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '@jbrowse/render-core/shaders/pointMarkConsts'

import { categoricalPalette, categoricalValueColor } from '../ui/colors.ts'
import { MISCONFIGURED_COLOR, NO_CATEGORY_COLOR } from './color/index.ts'
import { cssColorToABGR } from './colorBits.ts'
import Flatbush from './flatbush/index.ts'
import createJexlInstance from './jexl.ts'
import {
  encodeFeatures,
  encodedChannelTransferables,
  rampOverExtent,
} from './markEncoding.ts'
import SimpleFeature from './simpleFeature.ts'
import { thresholdPalette } from './thresholdScale.ts'

import type { ContinuousRef, ShapeName, LaneName } from './markEncoding.ts'

const jexl = createJexlInstance()
const ALL: LaneName[] = ['y', 'color', 'glyph', 'row', 'index']

function feature(
  i: number,
  data: Record<string, unknown> = {},
  start = i * 100,
  end = i * 100 + 50,
) {
  return new SimpleFeature({
    uniqueId: `f${i}`,
    refName: 'chr1',
    start,
    end,
    ...data,
  })
}

const features = [
  feature(0, { score: 10, strand: 1, type: 'gene' }),
  feature(1, { score: 40, strand: -1, type: 'exon' }),
  feature(2, { score: 25, strand: 1, type: 'gene' }),
  feature(3, { strand: -1, type: 'cds' }),
  feature(4, { score: 'n/a', strand: 1, type: 'gene' }),
]

test('x and x2 default to start and end, read natively', () => {
  const r = encodeFeatures(features, {}, ALL, { jexl })
  expect(r.count).toBe(5)
  expect([...r.x]).toEqual([0, 100, 200, 300, 400])
  expect([...r.x2]).toEqual([50, 150, 250, 350, 450])
  expect([...r.featureIndex]).toEqual([0, 1, 2, 3, 4])
  expect([...r.y]).toEqual([0, 0, 0, 0, 0])
  expect(r.yMin).toBe(Infinity)
  expect(r.yMax).toBe(-Infinity)
  expect(r.scale).toBeUndefined()
})

test('a declared y skips the features whose value is not finite, and counts them', () => {
  const r = encodeFeatures(features, { y: 'score' }, ALL, { jexl })
  expect(r.count).toBe(3)
  expect(r.skipped).toBe(2)
  expect([...r.y]).toEqual([10, 40, 25])
  expect([...r.featureIndex]).toEqual([0, 1, 2])
  expect(r.yMin).toBe(10)
  expect(r.yMax).toBe(40)
  const fb = Flatbush.from(r.flatbushData!)
  expect(fb.search(90, 39, 160, 41)).toEqual([1])
})

// `Number()` answers 0 for every one of these, which plotted a VCF's `DP=.`
// as a measured zero.
test('a value that holds no number is skipped, never plotted at zero', () => {
  const values = [30, null, '', [], [null], true, '.', [0.4, 0.1]]
  const r = encodeFeatures(
    values.map((qual, i) => feature(i, { qual })),
    { y: 'qual' },
    ['y'],
  )
  expect([...r.y]).toEqual([30])
  expect(r.skipped).toBe(values.length - 1)
})

test('a one-element list and a numeric string are the numbers they hold', () => {
  const r = encodeFeatures(
    [[0.25], '12', ' 7 '].map((qual, i) => feature(i, { qual })),
    { y: 'qual' },
    ['y'],
  )
  expect([...r.y]).toEqual([0.25, 12, 7])
})

test('a ramp value that holds no number paints the misconfiguration grey, not the colour of zero', () => {
  const r = encodeFeatures(
    [-1, null, 1].map((score, i) => feature(i, { score })),
    {
      color: {
        field: 'score',
        scale: 'linear',
        domainMin: -1,
        domainMax: 1,
        range: ['blue', 'white', 'red'],
      },
    },
    ['color'],
  )
  expect(r.color[1]).toBe(cssColorToABGR('#808080'))
  expect(r.color[1]).not.toBe(r.color[0])
})

// Walking cuts written high to low stopped at the first one a value was
// under, so the middle interval was never painted and its key row was empty.
test('threshold cuts written high to low paint the intervals they name', () => {
  const r = encodeFeatures(
    [0.05, 0.3, 0.7].map((pip, i) => feature(i, { pip })),
    {
      color: {
        field: 'pip',
        scale: 'threshold',
        domain: [0.5, 0.1],
        range: ['#111111', '#222222', '#333333'],
      },
    },
    ['color'],
  )
  expect([...r.color]).toEqual(
    ['#111111', '#222222', '#333333'].map(c => cssColorToABGR(c)),
  )
  expect(r.scale).toMatchObject({ kind: 'threshold', domain: [0.1, 0.5] })
})

function blackToWhite(color: Partial<ContinuousRef>) {
  return encodeFeatures(
    [0, 25, 50].map((score, i) => feature(i, { score })),
    {
      color: {
        field: 'score',
        scale: 'linear',
        range: ['black', 'white'],
        ...color,
      },
    },
    ['color'],
  )
}

test('reverse turns the ramp round over the same domain', () => {
  const forward = blackToWhite({ domainMin: 0, domainMax: 50 })
  const reversed = blackToWhite({ domainMin: 0, domainMax: 50, reverse: true })
  expect([forward.color[0], forward.color[2]]).toEqual(
    ['black', 'white'].map(c => cssColorToABGR(c)),
  )
  expect([reversed.color[0], reversed.color[2]]).toEqual(
    ['white', 'black'].map(c => cssColorToABGR(c)),
  )
  // the middle of a 256-entry table rounds either way by one level
  const grey = (packed: number) => packed & 0xff
  expect(
    Math.abs(grey(reversed.color[1]!) - grey(forward.color[1]!)),
  ).toBeLessThanOrEqual(1)
  expect(reversed.scale).toMatchObject({
    domain: [0, 50],
    pinned: [true, true],
  })
})

// A domain is a span and `reverse` its one direction, so ends written the
// wrong way round span the same interval rather than a second way to reverse.
test('ends written high to low span the same interval, unreversed', () => {
  const written = blackToWhite({ domainMin: 50, domainMax: 0 })
  const forward = blackToWhite({ domainMin: 0, domainMax: 50 })
  expect([...written.color]).toEqual([...forward.color])
  expect(written.scale).toMatchObject({ domain: [0, 50] })
})

test('a pinned floor keeps its value and the open ceiling follows the region', () => {
  const r = blackToWhite({ domainMin: -50 })
  expect(r.scale).toMatchObject({
    domain: [-50, 50],
    pinned: [true, false],
    extent: [0, 50],
  })
  expect(r.color[0]).toBe(cssColorToABGR('rgb(128,128,128)'))
  expect(r.color[2]).toBe(cssColorToABGR('white'))
})

test('a pinned ceiling keeps its value and the open floor follows the region', () => {
  const r = blackToWhite({ domainMax: 100 })
  expect(r.scale).toMatchObject({ domain: [0, 100], pinned: [false, true] })
  expect(r.color[0]).toBe(cssColorToABGR('black'))
  expect(r.color[2]).toBe(cssColorToABGR('rgb(128,128,128)'))
})

test('an open end never crosses a pinned one', () => {
  const r = blackToWhite({ domainMin: 80 })
  expect(r.scale).toMatchObject({ domain: [80, 80] })
  expect(new Set(r.color)).toEqual(new Set([cssColorToABGR('black')]))
})

test('scheme names the ramp, and range, where it lists colours, wins over it', () => {
  const viridis = blackToWhite({ range: undefined, scheme: 'viridis' })
  const unset = blackToWhite({ range: undefined })
  expect([...viridis.color]).toEqual([...unset.color])
  expect(viridis.color[0]).toBe(cssColorToABGR('#440154'))
  const both = blackToWhite({ scheme: 'viridis' })
  expect(both.color[0]).toBe(cssColorToABGR('black'))
})

test('a region holding no number spans [0, 1] and contributes no extent', () => {
  const r = encodeFeatures(
    [feature(0, { score: 'none' })],
    { color: { field: 'score', scale: 'linear', range: ['black', 'white'] } },
    ['color'],
  )
  expect(r.scale).toMatchObject({
    domain: [0, 1],
    extent: [Infinity, -Infinity],
  })
  if (r.scale?.kind === 'ramp') {
    expect(rampOverExtent(r.scale, r.scale.extent).domain).toEqual([0, 1])
  }
})

test('rampOverExtent widens only the open ends of a half-pinned table', () => {
  const r = blackToWhite({ domainMin: -50 })
  const table = r.scale
  expect(table?.kind).toBe('ramp')
  if (table?.kind === 'ramp') {
    expect(rampOverExtent(table, [-20, 200]).domain).toEqual([-50, 200])
    expect(rampOverExtent(table, [-100, -60]).domain).toEqual([-50, -50])
    const open = blackToWhite({}).scale
    if (open?.kind === 'ramp') {
      expect(rampOverExtent(open, [-20, 200]).domain).toEqual([-20, 200])
    }
  }
})

test('a jexl: field ref is the escape for a derived channel', () => {
  const r = encodeFeatures(
    features,
    { x: "jexl:get(feature,'start')+5", y: 'jexl:feature.score*2' },
    ALL,
    { jexl },
  )
  expect([...r.x]).toEqual([5, 105, 205])
  expect([...r.y]).toEqual([20, 80, 50])
})

test('a constant colour packs once, a jexl colour per feature', () => {
  const constant = encodeFeatures(features, { color: 'red' }, ALL, { jexl })
  expect(new Set(constant.color)).toEqual(new Set([cssColorToABGR('red')]))
  const perFeature = encodeFeatures(
    features,
    { color: "jexl:get(feature,'strand')==1?'red':'blue'" },
    ALL,
    { jexl },
  )
  expect([...perFeature.color]).toEqual(
    [1, -1, 1, -1, 1].map(s => cssColorToABGR(s === 1 ? 'red' : 'blue')),
  )
  expect(perFeature.scale).toBeUndefined()
})

test('an unpinned categorical scale colours by value, so two regions agree, and names the missing row', () => {
  const r = encodeFeatures(
    features,
    { color: { field: 'type', scale: 'categorical' } },
    ALL,
    { jexl },
  )
  const of = (label: string) =>
    cssColorToABGR(categoricalValueColor(label, categoricalPalette))
  expect(r.scale).toEqual({
    kind: 'categorical',
    field: 'type',
    domain: [],
    entries: [
      { value: 'cds', color: of('cds') },
      { value: 'exon', color: of('exon') },
      { value: 'gene', color: of('gene') },
    ],
  })
  expect([...r.color]).toEqual(['gene', 'exon', 'gene', 'cds', 'gene'].map(of))
  const other = encodeFeatures(
    [feature(9, { type: 'gene' }), feature(10, {})],
    { color: { field: 'type', scale: 'categorical' } },
    ALL,
    { jexl },
  )
  expect(other.color[0]).toBe(of('gene'))
  expect(other.scale).toEqual({
    kind: 'categorical',
    field: 'type',
    domain: [],
    entries: [
      { value: 'gene', color: of('gene') },
      { value: '', color: cssColorToABGR(NO_CATEGORY_COLOR) },
    ],
  })
  expect(other.color[1]).toBe(cssColorToABGR(NO_CATEGORY_COLOR))
})

test('a categorical domain pins the order and a palette the colours', () => {
  const r = encodeFeatures(
    features,
    {
      color: {
        field: 'strand',
        scale: 'categorical',
        domain: [-1, 1],
        range: ['red', 'blue'],
      },
    },
    ALL,
    { jexl },
  )
  expect(r.scale).toEqual({
    kind: 'categorical',
    field: 'strand',
    domain: ['-1', '1'],
    range: ['red', 'blue'],
    numericKeys: true,
    entries: [
      { value: '-1', color: cssColorToABGR('red') },
      { value: '1', color: cssColorToABGR('blue') },
    ],
  })
})

test('strand brings its own order and colours where the encoding names none', () => {
  const r = encodeFeatures(
    features,
    { color: { field: 'strand', scale: 'categorical' } },
    ALL,
    { jexl },
  )
  expect(r.scale).toEqual({
    kind: 'categorical',
    field: 'strand',
    domain: ['1', '-1', '0'],
    numericKeys: true,
    entries: [
      { value: '1', color: cssColorToABGR('tomato') },
      { value: '-1', color: cssColorToABGR('cornflowerblue') },
    ],
  })
})

test('two regions agree on a value the domain leaves out, whatever else each met', () => {
  const encoding = {
    color: { field: 'type', scale: 'categorical' as const, domain: ['gene'] },
  }
  const busy = encodeFeatures(
    [
      feature(0, { type: 'gene' }),
      feature(1, { type: 'exon' }),
      feature(2, { type: 'snoRNA' }),
    ],
    encoding,
    ALL,
    { jexl },
  )
  const sparse = encodeFeatures(
    [feature(3, { type: 'gene' }), feature(4, { type: 'snoRNA' })],
    encoding,
    ALL,
    { jexl },
  )
  expect(sparse.color[1]).toBe(busy.color[2])
  expect(busy.color[2]).not.toBe(busy.color[0])
})

test('the table lists the values met, the domain first and the rest in facet order', () => {
  const mixed = [
    feature(0, { type: 'exon' }),
    feature(1, { type: '' }),
    feature(2, { type: 'UTR' }),
    feature(3, { type: '10' }),
    feature(4, { type: '9' }),
  ]
  const labels = (domain?: string[]) => {
    const r = encodeFeatures(
      mixed,
      { color: { field: 'type', scale: 'categorical', domain } },
      ALL,
      { jexl },
    )
    return r.scale?.kind === 'categorical'
      ? r.scale.entries.map(e => e.value)
      : undefined
  }
  expect(labels()).toEqual(['9', '10', 'UTR', 'exon', ''])
  expect(labels(['exon', 'CDS'])).toEqual(['exon', '9', '10', 'UTR', ''])
})

test('a ramp scale reads the field through its domain into the LUT', () => {
  const r = encodeFeatures(
    features,
    {
      color: {
        field: 'score',
        scale: 'linear',
        range: ['black', 'white'],
      },
    },
    ALL,
    { jexl },
  )
  expect(r.scale?.kind).toBe('ramp')
  if (r.scale?.kind === 'ramp') {
    expect(r.scale.domain).toEqual([10, 40])
    expect(r.scale.lut.length).toBe(256 * 4)
  }
  // score 10 is the domain floor, 40 the ceiling, 25 halfway
  expect(r.color[0]).toBe(cssColorToABGR('black'))
  expect(r.color[1]).toBe(cssColorToABGR('white'))
  expect(r.color[2]).toBe(cssColorToABGR('rgb(128,128,128)'))
  // a feature with no value paints the fallback and stays in the payload
  expect(r.count).toBe(5)
  // the misconfiguration grey, which is not the no-category grey beside it
  expect(r.color[3]).toBe(cssColorToABGR('#808080'))
  expect(r.color[3]).not.toBe(cssColorToABGR(NO_CATEGORY_COLOR))
})

test('domainMid puts the ramp middle stop at that value', () => {
  const r = encodeFeatures(
    features,
    {
      color: {
        field: 'score',
        scale: 'linear',
        domainMin: 0,
        domainMax: 40,
        range: ['black', 'white', 'black'],
        domainMid: 10,
      },
    },
    ALL,
    { jexl },
  )
  // score 10 is the middle stop, 40 the far end
  expect(r.color[0]).toBe(cssColorToABGR('white'))
  expect(r.color[1]).toBe(cssColorToABGR('black'))
  if (r.scale?.kind === 'ramp') {
    expect(r.scale.domainMid).toBe(10)
  }
})

test('a pinned ramp domain wins over the region extremes', () => {
  const r = encodeFeatures(
    features,
    {
      color: {
        field: 'score',
        scale: 'linear',
        domainMin: 0,
        domainMax: 100,
        range: ['black', 'white'],
      },
    },
    ALL,
    { jexl },
  )
  expect(r.color[1]).toBe(cssColorToABGR('rgb(102,102,102)'))
})

test('a pinned ramp domain with no range steps at its value', () => {
  const r = encodeFeatures(
    features,
    {
      color: {
        field: 'score',
        scale: 'linear',
        domainMin: 25,
        domainMax: 25,
        range: ['black', 'white'],
      },
    },
    ALL,
    { jexl },
  )
  expect(r.color[0]).toBe(cssColorToABGR('black'))
  expect(r.color[1]).toBe(cssColorToABGR('white'))
  expect(r.color[2]).toBe(cssColorToABGR('black'))
})

test('the colorValue lane ships the raw values and the region extent instead of colours', () => {
  const r = encodeFeatures(
    features,
    { color: { field: 'score', scale: 'linear', range: ['black', 'white'] } },
    [...ALL, 'colorValue'],
    { jexl },
  )
  expect(r.color).toBeUndefined()
  expect([...r.colorValue]).toEqual([10, 40, 25, Number.NaN, Number.NaN])
  expect(r.scale?.kind).toBe('ramp')
  if (r.scale?.kind === 'ramp') {
    expect(r.scale.extent).toEqual([10, 40])
    expect(r.scale.pinned).toEqual([false, false])
    expect(r.scale.lut.length).toBe(256 * 4)
  }
  expect(encodedChannelTransferables(r)).toContain(r.colorValue.buffer)
})

test('a pinned domain says so, so the display leaves it alone', () => {
  const r = encodeFeatures(
    features,
    {
      color: { field: 'score', scale: 'log', domainMin: 1, domainMax: 100 },
    },
    [...ALL, 'colorValue'],
    { jexl },
  )
  expect(r.scale?.kind === 'ramp' && r.scale.pinned).toEqual([true, true])
  expect(r.scale?.kind === 'ramp' && r.scale.domain).toEqual([1, 100])
})

test('a threshold colour packs one palette entry per interval', () => {
  const palette = ['#357ebd', '#5cb85c', '#d43f3a']
  const r = encodeFeatures(
    features,
    {
      color: {
        field: 'score',
        scale: 'threshold',
        domain: [20, 30],
        range: palette,
      },
    },
    [...ALL, 'colorValue'],
    { jexl },
  )
  expect(r.colorValue).toBeUndefined()
  // scores 10, 40 and 25, then no score, then text that is no number: the
  // two keyless cases paint the greys the feature display's threshold paints
  // and file under its two rows
  const noValue = cssColorToABGR(NO_CATEGORY_COLOR)
  const notNumber = cssColorToABGR(MISCONFIGURED_COLOR)
  expect([...r.color]).toEqual([
    cssColorToABGR(palette[0]!),
    cssColorToABGR(palette[2]!),
    cssColorToABGR(palette[1]!),
    noValue,
    notNumber,
  ])
  expect(r.scale).toEqual({
    kind: 'threshold',
    field: 'score',
    domain: [20, 30],
    range: palette,
    missing: true,
    notNumber: true,
  })
})

test('a threshold table flags only the keyless cases a region met', () => {
  const r = encodeFeatures(
    features.slice(0, 1),
    { color: { field: 'score', scale: 'threshold', domain: [20, 30] } },
    ALL,
    { jexl },
  )
  expect(r.scale).toEqual({
    kind: 'threshold',
    field: 'score',
    domain: [20, 30],
  })
})

test('a threshold domain written as strings cuts at the numbers it names', () => {
  const r = encodeFeatures(
    features,
    { color: { field: 'score', scale: 'threshold', domain: ['20'] } },
    ALL,
    { jexl },
  )
  const [below, above] = thresholdPalette(2).map(c => cssColorToABGR(c))
  expect(r.color[0]).toBe(below)
  expect(r.color[1]).toBe(above)
  expect(r.scale).toMatchObject({ kind: 'threshold', domain: [20] })
})

test('a categorical colour resolves in the worker whatever lanes are named', () => {
  const r = encodeFeatures(
    features,
    { color: { field: 'strand', scale: 'categorical' } },
    [...ALL, 'colorValue'],
    { jexl },
  )
  expect(r.colorValue).toBeUndefined()
  expect(r.color).toBeDefined()
})

test('y is a field name, read the same way a reader in its place is', () => {
  const named = encodeFeatures(features, { y: 'score' }, ['y'], { jexl })
  const read = encodeFeatures(features, { y: f => f.get('score') }, ['y'], {
    jexl,
  })
  expect([...read.y]).toEqual([...named.y])
  expect(read.yMin).toBe(named.yMin)
})

test('shape is a name or a jexl expression returning one', () => {
  const named = encodeFeatures(features, { shape: 'triangle' }, ALL, { jexl })
  expect(new Set(named.glyph)).toEqual(new Set([GLYPH_TRIANGLE]))
  const derived = encodeFeatures(
    features,
    { shape: "jexl:get(feature,'type')=='exon'?'triangle':'circle'" },
    ALL,
    { jexl },
  )
  expect([...derived.glyph]).toEqual([
    GLYPH_DISC,
    GLYPH_TRIANGLE,
    GLYPH_DISC,
    GLYPH_DISC,
    GLYPH_DISC,
  ])
})

const GLYPHS: ShapeName[] = ['circle', 'triangle', 'diamond']
const CODE = {
  circle: GLYPH_DISC,
  triangle: GLYPH_TRIANGLE,
  diamond: GLYPH_DIAMOND,
}

test('an unpinned shape scale derives each shape from the value, so two regions agree', () => {
  const r = encodeFeatures(
    features,
    { shape: { field: 'type', scale: 'categorical' } },
    ALL,
    { jexl },
  )
  const of = (label: string) => categoricalValueColor(label, GLYPHS)
  expect(r.shapeScale).toEqual({
    kind: 'shape',
    field: 'type',
    domain: [],
    entries: [
      { value: 'cds', shape: of('cds') },
      { value: 'exon', shape: of('exon') },
      { value: 'gene', shape: of('gene') },
    ],
  })
  expect([...r.glyph]).toEqual(
    ['gene', 'exon', 'gene', 'cds', 'gene'].map(v => CODE[of(v)]),
  )
  expect(r.scale).toBeUndefined()
  const other = encodeFeatures(
    [feature(9, { type: 'exon' }), feature(10, {})],
    { shape: { field: 'type', scale: 'categorical' } },
    ALL,
    { jexl },
  )
  expect(other.glyph[0]).toBe(CODE[of('exon')])
  expect(other.glyph[1]).toBe(GLYPH_DISC)
  expect(other.shapeScale?.entries).toEqual([
    { value: 'exon', shape: of('exon') },
    { value: '', shape: 'circle' },
  ])
})

test('a pinned shape domain walks the range in order', () => {
  const r = encodeFeatures(
    features,
    {
      shape: {
        field: 'strand',
        scale: 'categorical',
        domain: [1, -1],
        range: ['triangle', 'diamond'],
      },
    },
    ALL,
    { jexl },
  )
  expect(r.shapeScale).toEqual({
    kind: 'shape',
    field: 'strand',
    domain: ['1', '-1'],
    range: ['triangle', 'diamond'],
    entries: [
      { value: '1', shape: 'triangle' },
      { value: '-1', shape: 'diamond' },
    ],
  })
  expect([...r.glyph]).toEqual([
    GLYPH_TRIANGLE,
    GLYPH_DIAMOND,
    GLYPH_TRIANGLE,
    GLYPH_DIAMOND,
    GLYPH_TRIANGLE,
  ])
})

test('colour and shape scales over different fields resolve side by side', () => {
  const r = encodeFeatures(
    features,
    {
      color: { field: 'type', scale: 'categorical', domain: ['gene', 'exon'] },
      shape: { field: 'strand', scale: 'categorical', domain: [1, -1] },
    },
    ALL,
    { jexl },
  )
  expect(r.scale?.kind).toBe('categorical')
  expect(r.shapeScale?.kind).toBe('shape')
  expect([...r.glyph]).toEqual([
    GLYPH_DISC,
    GLYPH_TRIANGLE,
    GLYPH_DISC,
    GLYPH_TRIANGLE,
    GLYPH_DISC,
  ])
  expect(r.color[0]).toBe(r.color[2])
  expect(r.color[0]).not.toBe(r.color[1])
})

test('an empty feature list ships no index', () => {
  const r = encodeFeatures([], { y: 'score' }, ALL, { jexl })
  expect(r.count).toBe(0)
  expect(r.flatbushData).toBeUndefined()
})

test("a channel spelled as a reader is read in the field ref's place", () => {
  const r = encodeFeatures(
    features,
    {
      y: f => Number(f.get('score')) * 2,
      color: f => (f.get('strand') === 1 ? 0xff0000ff : 0xff00ff00),
      shape: f => (f.get('type') === 'exon' ? GLYPH_TRIANGLE : GLYPH_DISC),
    },
    ALL,
    { jexl },
  )
  expect(r.count).toBe(3)
  expect([...r.y]).toEqual([20, 80, 50])
  expect([...r.color]).toEqual([0xff0000ff, 0xff00ff00, 0xff0000ff])
  expect([...r.glyph]).toEqual([GLYPH_DISC, GLYPH_TRIANGLE, GLYPH_DISC])
  expect(r.scale).toBeUndefined()
})

test('only the lanes asked for are filled, and the index only when named', () => {
  const r = encodeFeatures(features, { y: 'score' }, ['y'], { jexl })
  expect(r.count).toBe(3)
  expect([...r.y]).toEqual([10, 40, 25])
  expect(r.color).toBeUndefined()
  expect(r.glyph).toBeUndefined()
  expect(r.row).toBeUndefined()
  expect(r.flatbushData).toBeUndefined()
  expect(encodedChannelTransferables(r)).toHaveLength(4)
  // a declared y outside the lane set is not read: nothing is skipped
  const spans = encodeFeatures(features, { y: 'score' }, ['color', 'index'], {
    jexl,
  })
  expect(spans.count).toBe(5)
  expect(spans.y).toBeUndefined()
  expect(spans.yMin).toBe(Infinity)
  expect(Flatbush.from(spans.flatbushData!).search(90, -1, 160, 1)).toEqual([1])
})

test('row is an integer lane, 0 where the field is missing or negative', () => {
  const r = encodeFeatures(
    [
      feature(0, { sampleIndex: 2 }),
      feature(1, {}),
      feature(2, { sampleIndex: -1 }),
      feature(3, { sampleIndex: '1' }),
    ],
    { row: 'sampleIndex' },
    ['row'],
    { jexl },
  )
  expect([...r.row]).toEqual([2, 0, 0, 1])
  const bare = encodeFeatures(features, {}, ['row'], { jexl })
  expect([...bare.row]).toEqual([0, 0, 0, 0, 0])
})

test('a caller whose channels are readers or field names needs no jexl instance', () => {
  const r = encodeFeatures(features, { y: f => Number(f.get('score')) }, ['y'])
  expect([...r.y]).toEqual([10, 40, 25])
  expect(() =>
    encodeFeatures(features, { y: 'jexl:feature.score' }, ['y']),
  ).toThrow(/jexl/)
})

test('a categorical table says whether every key it met was a number', () => {
  const of = (field: string, list = features) =>
    encodeFeatures(list, { color: { field, scale: 'categorical' } }, ALL, {
      jexl,
    }).scale

  expect(of('strand')).toMatchObject({ numericKeys: true })
  expect(of('type')).not.toHaveProperty('numericKeys')
  // One key that is not a number is enough: `score` reads `n/a` on one
  // feature and nothing on another.
  expect(of('score')).not.toHaveProperty('numericKeys')
  expect(of('absent', [feature(9, {})])).not.toHaveProperty('numericKeys')
})
