import { SimpleFeature } from '@jbrowse/core/util'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { NO_VALUE_LABEL } from '@jbrowse/core/util/groupKeys'

import { laneColorKey, ribbonColorKey, ribbonColorScale } from './legend.ts'

import type { GlyphHit } from './multiwayRenderTypes.ts'
import type { Feature } from '@jbrowse/core/util'

const hit = (
  uniqueId: string,
  x1: number,
  x2: number,
  name?: string,
): GlyphHit => ({
  x1,
  x2,
  y1: 0,
  y2: 10,
  feature: new SimpleFeature({
    uniqueId,
    name,
    refName: 'ctgA',
    start: 0,
    end: 1,
  }),
  label: name ?? uniqueId,
})

const byId = (colors: Record<string, string>) => (feature: Feature) =>
  colors[feature.id()]

test('the key names the drawn colors left to right', () => {
  expect(
    laneColorKey(
      [hit('b', 300, 400, 'atpB'), hit('a', 100, 200, 'atpA')],
      [0, 800],
      byId({ a: '#f00', b: '#0f0' }),
    ),
  ).toEqual([
    { value: 'atpA', label: 'atpA', color: '#f00' },
    { value: 'atpB', label: 'atpB', color: '#0f0' },
  ])
})

// A row is a color, so two names on one color cannot both be rows: the reader
// cannot tell them apart in the picture either.
test('a second name on a color already keyed is dropped', () => {
  expect(
    laneColorKey(
      [hit('a', 100, 200, 'atpA'), hit('b', 300, 400, 'atpB')],
      [0, 800],
      byId({ a: '#f00', b: '#f00' }),
    ),
  ).toEqual([{ value: 'atpA', label: 'atpA', color: '#f00' }])
})

test('an unnamed feature names no color', () => {
  expect(
    laneColorKey(
      [hit('a', 100, 200), hit('b', 300, 400, 'atpB')],
      [0, 800],
      byId({ a: '#f00', b: '#0f0' }),
    ),
  ).toEqual([{ value: 'atpB', label: 'atpB', color: '#0f0' }])
})

// The cull that packs the hits runs half a screen wider than the window, and a
// key naming a gene the reader would have to pan to reach describes some other
// picture.
test('a hit off the window is not named', () => {
  expect(
    laneColorKey(
      [hit('a', -400, -300, 'atpA'), hit('b', 300, 400, 'atpB')],
      [0, 800],
      byId({ a: '#f00', b: '#0f0' }),
    ),
  ).toEqual([{ value: 'atpB', label: 'atpB', color: '#0f0' }])
})

test('a gene straddling the left edge is still named', () => {
  expect(
    laneColorKey([hit('a', -50, 50, 'atpA')], [0, 800], byId({ a: '#f00' })),
  ).toEqual([{ value: 'atpA', label: 'atpA', color: '#f00' }])
})

test('the ribbon key is the strand pair, in two colors', () => {
  expect(ribbonColorKey('strand').map(i => i.label)).toEqual([
    'Same orientation as lane above',
    'Inverted vs lane above',
  ])
  expect(new Set(ribbonColorKey('strand').map(i => i.color)).size).toBe(2)
})

// One flat color keys nothing, and a continuous ramp is not a row list.
test('the other two ribbon modes key no rows', () => {
  expect(ribbonColorKey('default')).toEqual([])
  expect(ribbonColorKey('identity')).toEqual([])
})

// A ramp mode keys the synteny view's ramp under the ribbons' own title, and
// keys nothing where no loaded pair carries the value it paints
test('a measurement keys the ramp it paints, and nothing where no ribbon carries one', () => {
  const scale = ribbonColorScale('identity', { identity: { min: 0.5, max: 1 } })
  expect(scale.kind).toBe('ramp')
  expect(scale.id).toBe('ribbons')
  expect(scale.title).toBe('Ribbon identity')
  expect(ribbonColorScale('dnds', { dnds: { min: 0, max: 3 } }).title).toBe(
    'Ribbon dN/dS',
  )
  expect(ribbonColorScale('identity', {})).toEqual({
    kind: 'categorical',
    id: 'ribbons',
    title: 'Ribbon colors',
    entries: [],
  })
})

// A text column keys one row per label, with the file color where the file
// gave one, the grey its unlabelled rows paint last, and past the readable cap
// a row saying how many labels it left out.
test('an attribute ribbon mode keys a row per label', () => {
  const rows = ribbonColorKey('attribute:group', {
    group: { labels: ['B1', 'A1a'], colors: { A1a: '#4DB5E3' } },
  })
  expect(rows.map(r => r.label)).toEqual(['B1', 'A1a', NO_VALUE_LABEL])
  expect(rows[1]!.color).toBe('#4DB5E3')
  expect(rows[2]).toEqual({
    value: NO_VALUE_LABEL,
    label: NO_VALUE_LABEL,
    color: NO_CATEGORY_COLOR,
    missing: true,
  })
  expect(ribbonColorKey('attribute:group')).toEqual([])
  const many = ribbonColorKey('attribute:group', {
    group: {
      labels: Array.from({ length: 33 }, (_, i) => `L${i}`),
      colors: {},
    },
  })
  expect(many.length).toBe(32)
  expect(many[30]).toEqual({ value: '', label: '+3 more' })
})

// The mode that draws the unlabelled rows at zero alpha names no grey: there
// is none on screen for the row to point at.
test('hiding the unlabelled rows drops the no-value row', () => {
  const ranges = { group: { labels: ['B1'], colors: {} } }
  expect(
    ribbonColorKey('attribute:group', ranges, true).map(r => r.label),
  ).toEqual(['B1'])
})
