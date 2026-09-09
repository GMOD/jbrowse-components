import { SimpleFeature } from '@jbrowse/core/util'

import { laneColorKey, ribbonColorKey } from './legend.ts'

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
    { label: 'atpA', color: '#f00' },
    { label: 'atpB', color: '#0f0' },
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
  ).toEqual([{ label: 'atpA', color: '#f00' }])
})

test('an unnamed feature names no color', () => {
  expect(
    laneColorKey(
      [hit('a', 100, 200), hit('b', 300, 400, 'atpB')],
      [0, 800],
      byId({ a: '#f00', b: '#0f0' }),
    ),
  ).toEqual([{ label: 'atpB', color: '#0f0' }])
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
  ).toEqual([{ label: 'atpB', color: '#0f0' }])
})

test('a gene straddling the left edge is still named', () => {
  expect(
    laneColorKey([hit('a', -50, 50, 'atpA')], [0, 800], byId({ a: '#f00' })),
  ).toEqual([{ label: 'atpA', color: '#f00' }])
})

test('the ribbon key is the strand pair, in two colors', () => {
  expect(ribbonColorKey('strand').map(i => i.label)).toEqual([
    'Same orientation as lane above',
    'Inverted vs lane above',
  ])
  expect(new Set(ribbonColorKey('strand').map(i => i.color)).size).toBe(2)
})

// One flat color keys nothing, and a continuous ramp is not a row list.
test('the other two ribbon modes key nothing', () => {
  expect(ribbonColorKey('default')).toEqual([])
  expect(ribbonColorKey('identity')).toEqual([])
})

// A text column keys one row per label, with the file color where the file
// gave one, and past the readable cap says how many it left out.
test('an attribute ribbon mode keys a row per label', () => {
  const rows = ribbonColorKey('attribute:group', {
    attribute: 'group',
    labels: ['B1', 'A1a'],
    colors: { A1a: '#4DB5E3' },
  })
  expect(rows.map(r => r.label)).toEqual(['B1', 'A1a'])
  expect(rows[1]!.color).toBe('#4DB5E3')
  expect(ribbonColorKey('attribute:group')).toEqual([])
  const many = ribbonColorKey('attribute:group', {
    attribute: 'group',
    labels: Array.from({ length: 33 }, (_, i) => `L${i}`),
    colors: {},
  })
  expect(many.length).toBe(31)
  expect(many[30]).toEqual({ label: '+3 more' })
})
