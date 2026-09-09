import {
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '@jbrowse/render-core/shaders/pointMarkConsts'

import { categoricalPalette } from '../ui/colors.ts'
import { cssColorToABGR } from './colorBits.ts'
import Flatbush from './flatbush/index.ts'
import createJexlInstance from './jexl.ts'
import { encodeFeatures } from './markEncoding.ts'
import SimpleFeature from './simpleFeature.ts'

const jexl = createJexlInstance()

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
  const r = encodeFeatures(features, {}, { jexl })
  expect(r.count).toBe(5)
  expect([...r.x]).toEqual([0, 100, 200, 300, 400])
  expect([...r.x2]).toEqual([50, 150, 250, 350, 450])
  expect([...r.featureIndex]).toEqual([0, 1, 2, 3, 4])
  expect([...r.y]).toEqual([0, 0, 0, 0, 0])
  expect(r.yMin).toBe(Infinity)
  expect(r.yMax).toBe(-Infinity)
  expect(r.scale).toBeUndefined()
})

test('a declared y skips the features whose value is not finite', () => {
  const r = encodeFeatures(features, { y: 'score' }, { jexl })
  expect(r.count).toBe(3)
  expect([...r.y]).toEqual([10, 40, 25])
  expect([...r.featureIndex]).toEqual([0, 1, 2])
  expect(r.yMin).toBe(10)
  expect(r.yMax).toBe(40)
  const fb = Flatbush.from(r.flatbushData!)
  expect(fb.search(90, 39, 160, 41)).toEqual([1])
})

test('a jexl: field ref is the escape for a derived channel', () => {
  const r = encodeFeatures(
    features,
    { x: "jexl:get(feature,'start')+5", y: 'jexl:feature.score*2' },
    { jexl },
  )
  expect([...r.x]).toEqual([5, 105, 205])
  expect([...r.y]).toEqual([20, 80, 50])
})

test('a constant colour packs once, a jexl colour per feature', () => {
  const constant = encodeFeatures(features, { color: 'red' }, { jexl })
  expect(new Set(constant.color)).toEqual(new Set([cssColorToABGR('red')]))
  const perFeature = encodeFeatures(
    features,
    { color: "jexl:get(feature,'strand')==1?'red':'blue'" },
    { jexl },
  )
  expect([...perFeature.color]).toEqual(
    [1, -1, 1, -1, 1].map(s => cssColorToABGR(s === 1 ? 'red' : 'blue')),
  )
  expect(perFeature.scale).toBeUndefined()
})

test('a categorical scale hands out palette entries in sorted order and reports the table', () => {
  const r = encodeFeatures(
    features,
    { color: { field: 'type', scale: 'categorical' } },
    { jexl },
  )
  const [p0, p1, p2] = categoricalPalette.map(cssColorToABGR)
  expect(r.scale).toEqual({
    kind: 'categorical',
    field: 'type',
    entries: [
      { label: 'cds', color: p0 },
      { label: 'exon', color: p1 },
      { label: 'gene', color: p2 },
    ],
  })
  expect([...r.color]).toEqual([p2, p1, p2, p0, p2])
})

test('a categorical domain pins the order, a palette the colours, and numbers sort numerically', () => {
  const r = encodeFeatures(
    features,
    {
      color: {
        field: 'strand',
        scale: 'categorical',
        domain: [1],
        palette: ['red', 'blue'],
      },
    },
    { jexl },
  )
  expect(r.scale).toEqual({
    kind: 'categorical',
    field: 'strand',
    entries: [
      { label: '1', color: cssColorToABGR('red') },
      { label: '-1', color: cssColorToABGR('blue') },
    ],
  })
  const bySortedValue = encodeFeatures(
    features,
    { color: { field: 'strand', scale: 'categorical' } },
    { jexl },
  )
  expect(
    bySortedValue.scale?.kind === 'categorical'
      ? bySortedValue.scale.entries.map(e => e.label)
      : undefined,
  ).toEqual(['-1', '1'])
})

test('a ramp scale reads the field through its domain into the LUT', () => {
  const r = encodeFeatures(
    features,
    {
      color: {
        field: 'score',
        scale: 'linear',
        ramp: ['black', 'white'],
      },
    },
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
  expect(r.color[3]).toBe(cssColorToABGR('#808080'))
})

test('a pinned ramp domain wins over the region extremes', () => {
  const r = encodeFeatures(
    features,
    {
      color: {
        field: 'score',
        scale: 'linear',
        domain: [0, 100],
        ramp: ['black', 'white'],
      },
    },
    { jexl },
  )
  expect(r.color[1]).toBe(cssColorToABGR('rgb(102,102,102)'))
})

test('glyph is a name or a jexl expression returning one', () => {
  const named = encodeFeatures(features, { glyph: 'triangle' }, { jexl })
  expect(new Set(named.glyph)).toEqual(new Set([GLYPH_TRIANGLE]))
  const derived = encodeFeatures(
    features,
    { glyph: "jexl:get(feature,'type')=='exon'?'triangle':'disc'" },
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

test('an empty feature list ships no index', () => {
  const r = encodeFeatures([], { y: 'score' }, { jexl })
  expect(r.count).toBe(0)
  expect(r.flatbushData).toBeUndefined()
})
