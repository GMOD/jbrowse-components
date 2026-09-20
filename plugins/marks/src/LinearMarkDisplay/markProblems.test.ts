import fs from 'node:fs'

import { markProblems, problemText } from './markProblems.ts'

function texts(marks: unknown[], faceted = false) {
  return markProblems(marks as Parameters<typeof markProblems>[0], faceted).map(
    problemText,
  )
}

const COVERAGE = {
  shape: 'bar',
  transform: [{ type: 'coverage' }],
  encoding: { y: 'coverage' },
}
const PILEUP = { shape: 'span', transform: [{ type: 'pileup' }] }

interface ShippedConfig {
  tracks: {
    trackId: string
    displays?: { type: string; marks?: unknown[]; facet?: unknown }[]
  }[]
}

const SHIPPED = [
  'test_data/volvox/config_marks.json',
  'test_data/alu_age/config.json',
  'demos/read_marks/config.json',
]

test.each(SHIPPED)('%s draws every mark it declares as written', path => {
  const config = JSON.parse(
    fs.readFileSync(`${__dirname}/../../../../${path}`, 'utf8'),
  ) as ShippedConfig
  const displays = config.tracks.flatMap(t =>
    (t.displays ?? [])
      .filter(d => d.type === 'LinearMarkDisplay')
      .map(d => ({ trackId: t.trackId, ...d })),
  )
  expect(displays.length).toBeGreaterThan(0)
  expect(
    displays.flatMap(d =>
      texts(d.marks ?? [], d.facet !== undefined).map(
        t => `${d.trackId}: ${t}`,
      ),
    ),
  ).toEqual([])
})

test('the guide examples have no problems', () => {
  expect(
    texts([
      { shape: 'bar', encoding: { y: 'score' }, maxBpPerPx: 100 },
      {
        shape: 'bar',
        transform: [
          { type: 'bin', step: 'auto' },
          { type: 'aggregate', ops: [{ op: 'count' }] },
        ],
        encoding: { y: 'count' },
        minBpPerPx: 100,
      },
    ]),
  ).toEqual([])
  expect(texts([PILEUP])).toEqual([])
  expect(texts([COVERAGE])).toEqual([])
})

test('a valued mark beside a stacked span is told it stands in the first row, unless they never draw together or a facet bands them', () => {
  expect(texts([COVERAGE, PILEUP])).toEqual([
    'mark 0 encoding.row: stands in the first of the rows mark 1 bands the plot into, its axis repeated per row',
  ])
  expect(
    texts([
      { ...COVERAGE, minBpPerPx: 20 },
      { ...PILEUP, maxBpPerPx: 20 },
    ]),
  ).toEqual([])
  expect(texts([COVERAGE, PILEUP], true)).toEqual([])
})

test('two marks packing rows of their own are pointed at one shared pileup', () => {
  const filtered = (expr: string) => ({
    shape: 'span',
    transform: [{ type: 'filter', expr }, { type: 'pileup' }],
  })
  expect(texts([filtered('jexl:a'), filtered('jexl:b')])).toEqual([
    expect.stringMatching(
      /^mark 1 transform: packs rows of its own, as mark 0/,
    ),
  ])
})

test('a y the steps do not write names what they leave', () => {
  expect(
    texts([
      {
        shape: 'bar',
        transform: [{ type: 'bin', step: 1000 }, { type: 'aggregate' }],
        encoding: { y: 'score' },
      },
    ]),
  ).toEqual([
    'mark 0 encoding.y: reads "score", which its steps do not write; they leave refName, start, end',
  ])
  expect(
    texts([
      {
        shape: 'bar',
        transform: [
          { type: 'aggregate', ops: [{ op: 'mean', field: 'score' }] },
          { type: 'formula', expr: 'jexl:feature.mean_score*2', as: 'twice' },
        ],
        encoding: { y: 'twice' },
      },
    ]),
  ).toEqual([])
  expect(
    texts([{ ...COVERAGE, encoding: { y: 'jexl:feature.coverage' } }]),
  ).toEqual([])
})

test('a step says which of its slots cannot run', () => {
  expect(
    texts([
      {
        shape: 'bar',
        encoding: { y: 'sum' },
        transform: [
          { type: 'filter', expr: 'feature.score > 1' },
          { type: 'bin', step: 0 },
          { type: 'aggregate', ops: [{ op: 'sum', as: 'sum' }] },
        ],
      },
    ]),
  ).toEqual([
    'mark 0 transform.0.expr: a filter reads a jexl: expression',
    'mark 0 transform.1.step: a bin is a positive width in bp',
    'mark 0 transform.2.ops.0.field: sum reads a field and names none',
  ])
})

test('a jexl: field on a step is pointed at formula, where a dotted path is read', () => {
  const mean = (field: string) => [
    {
      shape: 'bar',
      encoding: { y: 'm' },
      transform: [{ type: 'aggregate', ops: [{ op: 'mean', field, as: 'm' }] }],
    },
  ]
  expect(texts(mean('INFO.DP'))).toEqual([])
  expect(texts(mean('jexl:feature.INFO.DP[0]'))).toEqual([
    'mark 0 transform.0.ops.0.field: the aggregate step reads a field name or a dotted path; a formula step in front computes one',
  ])
})

test('threshold cuts written high to low are told which way they are read', () => {
  const cuts = (domain: unknown[]) => [
    {
      shape: 'point',
      encoding: {
        y: 'score',
        color: { field: 'pip', scale: 'threshold', domain },
      },
    },
  ]
  expect(texts(cuts(['0.1', '0.5']))).toEqual([])
  expect(texts(cuts(['0.5', '0.1']))).toEqual([
    expect.stringMatching(/^mark 0 encoding.color.domain: threshold cuts are/),
  ])
  expect(texts(cuts(['low', 'high']))).toHaveLength(1)
})

test('a zoom range that admits no zoom never draws', () => {
  expect(
    texts([
      {
        shape: 'bar',
        encoding: { y: 'score' },
        minBpPerPx: 100,
        maxBpPerPx: 20,
      },
    ]),
  ).toEqual([
    'mark 0 minBpPerPx: never draws: minBpPerPx 100 is not below maxBpPerPx 20',
  ])
})

test('a second density mark drawing with the first is told the first stands in', () => {
  const density = { shape: 'bar', source: 'density', encoding: { y: 'count' } }
  expect(texts([density, density])).toEqual([
    'mark 1 source: mark 0 already stands in for the density sidecar here',
  ])
})
