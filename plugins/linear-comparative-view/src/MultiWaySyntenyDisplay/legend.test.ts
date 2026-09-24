import { SimpleFeature } from '@jbrowse/core/util'
import {
  NO_VALUE_LABEL,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import {
  laneColorKey,
  laneFieldKey,
  ribbonColorKey,
  ribbonColorScales,
} from './legend.ts'

import type { GlyphHit } from './multiwayRenderTypes.ts'

const hit = (
  uniqueId: string,
  x1: number,
  x2: number,
  css: string,
  name?: string,
  key?: string,
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
  fill: { css, packed: cssColorToABGR(css), key },
})

test('the key names the drawn colors left to right', () => {
  expect(
    laneColorKey(
      [hit('b', 300, 400, '#0f0', 'atpB'), hit('a', 100, 200, '#f00', 'atpA')],
      [0, 800],
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
      [hit('a', 100, 200, '#f00', 'atpA'), hit('b', 300, 400, '#f00', 'atpB')],
      [0, 800],
    ),
  ).toEqual([{ value: 'atpA', label: 'atpA', color: '#f00' }])
})

test('an unnamed feature names no color', () => {
  expect(
    laneColorKey(
      [hit('a', 100, 200, '#f00'), hit('b', 300, 400, '#0f0', 'atpB')],
      [0, 800],
    ),
  ).toEqual([{ value: 'atpB', label: 'atpB', color: '#0f0' }])
})

// The cull that packs the hits runs half a screen wider than the window, and a
// key naming a gene the reader would have to pan to reach describes some other
// picture.
test('a hit off the window is not named', () => {
  expect(
    laneColorKey(
      [
        hit('a', -400, -300, '#f00', 'atpA'),
        hit('b', 300, 400, '#0f0', 'atpB'),
      ],
      [0, 800],
    ),
  ).toEqual([{ value: 'atpB', label: 'atpB', color: '#0f0' }])
})

test('a gene straddling the left edge is still named', () => {
  expect(laneColorKey([hit('a', -50, 50, '#f00', 'atpA')], [0, 800])).toEqual([
    { value: 'atpA', label: 'atpA', color: '#f00' },
  ])
})

// A painting field keys the values its marks were filed under, in the field's
// own order, and the gene no cluster claims as the no-value row.
test('a field keys the values on screen through the channel', () => {
  const field = categoricalField('cluster', { domain: ['rbcL'] })
  const [scale] = laneFieldKey(
    [
      hit('a', 100, 200, field.color('psbA'), 'x', 'psbA'),
      hit('b', 300, 400, field.color('rbcL'), 'y', 'rbcL'),
      hit('c', 500, 600, field.color(''), 'z', ''),
      hit('d', -400, -300, field.color('atpA'), 'w', 'atpA'),
    ],
    [0, 800],
    field,
  )
  expect(scale?.title).toBe('Gene cluster')
  expect(
    scale?.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
  ).toEqual(['rbcL', 'psbA', NO_VALUE_LABEL])
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
  const [scale] = ribbonColorScales('identity', {
    identity: { min: 0.5, max: 1 },
  })
  expect(scale!.kind).toBe('ramp')
  expect(scale!.id).toBe('ribbons')
  expect(scale!.title).toBe('Ribbon identity')
  expect(
    ribbonColorScales('dnds', { dnds: { min: 0, max: 3 } })[0]!.title,
  ).toBe('Ribbon dN/dS')
  expect(ribbonColorScales('identity', {})).toEqual([
    {
      kind: 'categorical',
      id: 'ribbons',
      title: 'Ribbon colors',
      entries: [],
    },
  ])
})

// A pair with no value keeps the slot color, so that is the color its row
// names, beside the ramp or among the labels
test('a pair with no value is keyed in the slot color it paints', () => {
  const slot = 'rgba(130,130,130,0.3)'
  const [, noValue] = ribbonColorScales(
    'identity',
    { identity: { min: 0.5, max: 1, missing: true } },
    undefined,
    false,
    slot,
  )
  expect(noValue).toMatchObject({
    entries: [{ label: NO_VALUE_LABEL, color: slot }],
  })
  const rows = ribbonColorKey(
    'group',
    { group: { labels: ['B1'], colors: {}, missing: true } },
    false,
    slot,
  )
  expect(rows.at(-1)!.color).toBe(slot)
})

// A text column keys one row per label, with the file color where the file
// gave one, the grey its unlabelled rows paint last where some pair carried no
// label, and past the readable cap a row saying how many labels it left out.
test('an attribute ribbon mode keys a row per label', () => {
  const rows = ribbonColorKey('group', {
    group: {
      labels: ['B1', 'A1a'],
      colors: { A1a: '#4DB5E3' },
      missing: true,
    },
  })
  expect(rows.map(r => r.label)).toEqual(['B1', 'A1a', NO_VALUE_LABEL])
  expect(rows[1]!.color).toBe('#4DB5E3')
  expect(rows[2]).toEqual({
    value: NO_VALUE_LABEL,
    label: NO_VALUE_LABEL,
    color: NO_CATEGORY_COLOR,
    missing: true,
  })
  expect(ribbonColorKey('group')).toEqual([])
  const labels = Array.from({ length: 33 }, (_, i) => `L${i}`)
  const many = ribbonColorKey('group', {
    group: {
      labels,
      colors: Object.fromEntries(
        labels.map((l, i) => [l, `#${(i + 1).toString(16).padStart(6, '0')}`]),
      ),
      missing: true,
    },
  })
  expect(many.length).toBe(32)
  expect(many[30]).toEqual({ value: '', label: '+3 more' })
})

// The mode that draws the unlabelled rows at zero alpha names no grey: there
// is none on screen for the row to point at.
test('hiding the unlabelled rows drops the no-value row', () => {
  const ranges = { group: { labels: ['B1'], colors: {}, missing: true } }
  expect(ribbonColorKey('group', ranges, true).map(r => r.label)).toEqual([
    'B1',
  ])
})
