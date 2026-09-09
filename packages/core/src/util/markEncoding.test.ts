import {
  GLYPH_DIAMOND,
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '@jbrowse/render-core/shaders/pointMarkConsts'

import { categoricalPalette, categoricalValueColor } from '../ui/colors.ts'
import { cssColorToABGR } from './colorBits.ts'
import Flatbush from './flatbush/index.ts'
import createJexlInstance from './jexl.ts'
import {
  NO_VALUE_LABEL,
  encodeFeatures,
  encodedChannelTransferables,
} from './markEncoding.ts'
import SimpleFeature from './simpleFeature.ts'

import type { GlyphName, LaneName } from './markEncoding.ts'

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

test('a declared y skips the features whose value is not finite', () => {
  const r = encodeFeatures(features, { y: 'score' }, ALL, { jexl })
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
    entries: [
      { label: 'cds', color: of('cds') },
      { label: 'exon', color: of('exon') },
      { label: 'gene', color: of('gene') },
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
    entries: [
      { label: 'gene', color: of('gene') },
      { label: NO_VALUE_LABEL, color: cssColorToABGR('#808080') },
    ],
  })
  expect(other.color[1]).toBe(cssColorToABGR('#808080'))
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
    ALL,
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
    ALL,
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
    ALL,
    { jexl },
  )
  expect(r.color[1]).toBe(cssColorToABGR('rgb(102,102,102)'))
})

test('glyph is a name or a jexl expression returning one', () => {
  const named = encodeFeatures(features, { glyph: 'triangle' }, ALL, { jexl })
  expect(new Set(named.glyph)).toEqual(new Set([GLYPH_TRIANGLE]))
  const derived = encodeFeatures(
    features,
    { glyph: "jexl:get(feature,'type')=='exon'?'triangle':'disc'" },
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

const GLYPHS: GlyphName[] = ['disc', 'triangle', 'diamond']
const CODE = {
  disc: GLYPH_DISC,
  triangle: GLYPH_TRIANGLE,
  diamond: GLYPH_DIAMOND,
}

test('an unpinned glyph scale derives each glyph from the value, so two regions agree', () => {
  const r = encodeFeatures(
    features,
    { glyph: { field: 'type', scale: 'categorical' } },
    ALL,
    { jexl },
  )
  const of = (label: string) => categoricalValueColor(label, GLYPHS)
  expect(r.glyphScale).toEqual({
    kind: 'glyph',
    field: 'type',
    entries: [
      { label: 'cds', glyph: of('cds') },
      { label: 'exon', glyph: of('exon') },
      { label: 'gene', glyph: of('gene') },
    ],
  })
  expect([...r.glyph]).toEqual(
    ['gene', 'exon', 'gene', 'cds', 'gene'].map(v => CODE[of(v)]),
  )
  expect(r.scale).toBeUndefined()
  const other = encodeFeatures(
    [feature(9, { type: 'exon' }), feature(10, {})],
    { glyph: { field: 'type', scale: 'categorical' } },
    ALL,
    { jexl },
  )
  expect(other.glyph[0]).toBe(CODE[of('exon')])
  expect(other.glyph[1]).toBe(GLYPH_DISC)
  expect(other.glyphScale?.entries).toEqual([
    { label: 'exon', glyph: of('exon') },
    { label: NO_VALUE_LABEL, glyph: 'disc' },
  ])
})

test('a pinned glyph domain walks the range in order', () => {
  const r = encodeFeatures(
    features,
    {
      glyph: {
        field: 'strand',
        scale: 'categorical',
        domain: [1, -1],
        range: ['triangle', 'diamond'],
      },
    },
    ALL,
    { jexl },
  )
  expect(r.glyphScale).toEqual({
    kind: 'glyph',
    field: 'strand',
    entries: [
      { label: '1', glyph: 'triangle' },
      { label: '-1', glyph: 'diamond' },
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

test('colour and glyph scales over different fields resolve side by side', () => {
  const r = encodeFeatures(
    features,
    {
      color: { field: 'type', scale: 'categorical', domain: ['gene', 'exon'] },
      glyph: { field: 'strand', scale: 'categorical', domain: [1, -1] },
    },
    ALL,
    { jexl },
  )
  expect(r.scale?.kind).toBe('categorical')
  expect(r.glyphScale?.kind).toBe('glyph')
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
      glyph: f => (f.get('type') === 'exon' ? GLYPH_TRIANGLE : GLYPH_DISC),
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
