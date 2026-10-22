import { SimpleFeature } from '@jbrowse/core/util'
import {
  NO_VALUE_LABEL,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import {
  colorEncodingOf,
  colorFieldOf,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'

import { geneColorConfigSchema } from './geneColorConfigSchema.ts'
import {
  laneColorKey,
  laneFieldKey,
  ribbonColorKey,
  ribbonColorScales,
  stackGeneKey,
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

test("a field's unknown paints the values its domain leaves out one row, Other", () => {
  const field = categoricalField('cluster', {
    domain: ['rbcL'],
    unknown: '#cccccc',
  })
  const [scale] = laneFieldKey(
    [
      hit('a', 100, 200, field.color('psbA'), 'x', 'psbA'),
      hit('b', 300, 400, field.color('rbcL'), 'y', 'rbcL'),
      hit('c', 500, 600, field.color('atpA'), 'z', 'atpA'),
    ],
    [0, 800],
    field,
  )
  expect(
    scale?.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
  ).toEqual(['rbcL', 'Other'])
})

test('the gene color config carries unknown to the field it paints through', () => {
  const conf = geneColorConfigSchema.create({
    field: 'cluster',
    scale: { domain: ['rbcL'], unknown: '#cccccc' },
  })
  const field = colorFieldOf(colorEncodingOf(colorSnapshotOf(conf)))
  expect(field?.color('psbA')).toBe('#cccccc')
})

test("color's title and labels head and name the field's key", () => {
  const field = categoricalField('cluster', {
    domain: ['rbcL'],
    labels: ['RuBisCO'],
  })
  const [scale] = laneFieldKey(
    [
      hit('a', 100, 200, field.color('psbA'), 'x', 'psbA'),
      hit('b', 300, 400, field.color('rbcL'), 'y', 'rbcL'),
    ],
    [0, 800],
    field,
    'Ortholog group',
  )
  expect(scale?.title).toBe('Ortholog group')
  expect(
    scale?.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
  ).toEqual(['RuBisCO', 'psbA'])
})

test('the ribbon key is the strand pair, in the genes’ strand colors', () => {
  const [forward, reverse] = UNIVERSAL_FIELD_PRESETS.strand.scale.range
  expect(ribbonColorKey('strand')).toEqual([
    expect.objectContaining({
      label: 'Same orientation as lane above',
      color: forward,
    }),
    expect.objectContaining({
      label: 'Inverted vs lane above',
      color: reverse,
    }),
  ])
})

test('the strand key names the genome each lane is read against', () => {
  expect(
    ribbonColorKey('strand', {}, { against: 'hg38' }).map(e => e.label),
  ).toEqual(['Same orientation as hg38', 'Inverted vs hg38'])
})

test('the strand key takes the colors range writes and the names it gives', () => {
  expect(
    ribbonColorKey(
      'strand',
      {},
      { paint: { range: ['gold', 'black'] }, names: ['Kept', 'Flipped'] },
    ),
  ).toEqual([
    { value: 'same', label: 'Kept', color: 'gold' },
    { value: 'inverted', label: 'Flipped', color: 'black' },
  ])
})

test('a measurement in bins keys them under the ribbons heading', () => {
  const [scale] = ribbonColorScales('mapq', {
    mappingQual: { min: 0, max: 60 },
  })
  expect(scale).toMatchObject({
    kind: 'categorical',
    id: 'ribbons',
    title: 'Ribbon mapping quality',
  })
  expect(
    scale?.kind === 'categorical' && scale.entries.map(e => e.label),
  ).toEqual([
    'MAPQ 30+ (high confidence)',
    'MAPQ 10-29',
    'MAPQ 1-9 (low)',
    'MAPQ 0 (multi-mapping)',
  ])
})

test('the other two ribbon modes key no rows', () => {
  expect(ribbonColorKey('default')).toEqual([])
  expect(ribbonColorKey('identity')).toEqual([])
})

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

test("the ribbons' declared ramp keys its pinned end", () => {
  const [scale] = ribbonColorScales(
    'identity',
    { identity: { min: 0.5, max: 1 } },
    { paint: { domainMin: 0.9 } },
  )
  expect(scale!.kind === 'ramp' && scale!.domain).toEqual([0.9, 1])
})

test('a pair with no value is keyed in the color it paints', () => {
  const slot = 'rgba(130,130,130,0.3)'
  const [, noValue] = ribbonColorScales(
    'identity',
    { identity: { min: 0.5, max: 1, missing: true } },
    { slotColor: slot },
  )
  expect(noValue).toMatchObject({
    entries: [{ label: NO_VALUE_LABEL, color: NO_CATEGORY_COLOR }],
  })
  const rows = ribbonColorKey(
    'group',
    { group: { labels: ['B1'], colors: {}, missing: true } },
    { slotColor: slot },
  )
  expect(rows.at(-1)!.color).toBe(slot)
})

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

test("the ribbon color's title and names head and name the ribbons' key", () => {
  const ranges = {
    group: { labels: ['C1', 'B1'], colors: {}, domain: ['C1'] },
  }
  const [scale] = ribbonColorScales('group', ranges, {
    names: ['Core'],
    title: 'Gene family',
  })
  expect(scale?.title).toBe('Gene family')
  expect(
    scale?.kind === 'categorical' ? scale.entries.map(e => e.label) : [],
  ).toEqual(['Core', 'B1'])
  expect(ribbonColorScales('group', ranges)[0]?.title).toBe('Ribbon colors')
  expect(ribbonColorScales('group', ranges, { title: '' })[0]?.title).toBe('')
  expect(
    ribbonColorScales(
      'identity',
      { identity: { min: 0, max: 1 } },
      { title: 'Percent identity' },
    )[0]?.title,
  ).toBe('Percent identity')
})

test('hiding the unlabelled rows drops the no-value row', () => {
  const ranges = { group: { labels: ['B1'], colors: {}, missing: true } }
  expect(
    ribbonColorKey('group', ranges, { hideUnlabelled: true }).map(r => r.label),
  ).toEqual(['B1'])
})

describe('the gene key over a stack', () => {
  const field = categoricalField('name')
  const named = (row: number, i: number, name: string) =>
    hit(`r${row}g${i}`, i * 10, i * 10 + 5, field.color(name), name, name)
  const keyOf = (hits: GlyphHit[]) => laneFieldKey(hits, [0, 800], field)
  const labels = (scales: ReturnType<typeof keyOf>) =>
    scales
      .flatMap(s => (s.kind === 'categorical' ? s.entries : []))
      .map(e => e.label)

  test('lists a gene only a mate lane carries', () => {
    const key = stackGeneKey(
      [[named(0, 0, 'GSTT2'), named(0, 1, 'GSTT4')], [named(1, 2, 'GSTT1')]],
      keyOf,
    )
    expect(labels(key).toSorted()).toEqual(['GSTT1', 'GSTT2', 'GSTT4'])
  })

  test("falls back to the anchor lane's genes where every lane's overflow it", () => {
    const strains = Array.from({ length: 40 }, (_, i) => named(1, i, `g${i}`))
    const key = stackGeneKey(
      [[named(0, 0, 'atpA'), named(0, 1, 'atpB')], strains],
      keyOf,
    )
    expect(labels(key).toSorted()).toEqual(['atpA', 'atpB'])
  })
})

test('a jexl color names a gene that carries only an ID by its ID', () => {
  const gene = new SimpleFeature({
    uniqueId: 'g',
    id: 'GSTT2B',
    refName: 'ctgA',
    start: 0,
    end: 1,
  })
  expect(
    laneColorKey(
      [
        {
          x1: 0,
          x2: 10,
          y1: 0,
          y2: 10,
          feature: gene,
          label: 'GSTT2B',
          fill: { css: '#f00', packed: cssColorToABGR('#f00') },
        },
        hit('b', 20, 30, '#0f0', 'GSTT4'),
      ],
      [0, 800],
    ).map(e => e.label),
  ).toEqual(['GSTT2B', 'GSTT4'])
})
