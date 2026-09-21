import fs from 'node:fs'

import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { configSchemaFactory, markRequirementProblems } from './configSchema.ts'
import { MARK_RULES, markProblems, problemText } from './markProblems.ts'

import type {
  FacetSnapshot,
  MarkProblem,
  MarkSnapshot,
} from './markProblems.ts'

const schema = configSchemaFactory()
const reached = new Set<string>()

// The list as the display reads it: the schema's own lift, defaults left off.
function problemsOf(marks: unknown[], facet?: unknown): MarkProblem[] {
  const snap: { marks?: MarkSnapshot[]; facet?: FacetSnapshot } = getSnapshot(
    schema.create({ displayId: 'd', marks, ...(facet ? { facet } : {}) }),
  )
  const lifted = snap.marks ?? []
  const problems = [
    ...markRequirementProblems(lifted),
    ...markProblems(lifted, snap.facet),
  ]
  for (const { rule } of problems) {
    reached.add(rule)
  }
  return problems
}

function found(marks: unknown[], facet?: unknown) {
  return problemsOf(marks, facet).map(
    p => `${p.level} ${p.rule} mark ${p.mark} ${p.slot}`,
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
      problemsOf(d.marks ?? [], d.facet).map(
        p => `${d.trackId}: ${problemText(p)}`,
      ),
    ),
  ).toEqual([])
})

test('the guide examples have no problems', () => {
  expect(
    found([
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
  expect(found([PILEUP])).toEqual([])
  expect(found([COVERAGE])).toEqual([])
})

test('a bar or point naming no y is the schema requirement, said once', () => {
  expect(
    problemsOf([{ shape: 'bar' }, { shape: 'point', encoding: {} }]),
  ).toEqual(
    [0, 1].map(mark => ({
      rule: 'mark-without-value',
      level: 'error',
      mark,
      slot: 'encoding.y',
      message:
        'a bar or a point stands at a value and names no y field to plot, so it draws nothing',
    })),
  )
  expect(found([{ shape: 'span' }])).toEqual([])
})

test('a channel the shape does not read waits unread', () => {
  expect(found([{ shape: 'span', encoding: { y: 'score' } }])).toEqual([
    'warning unread-channel mark 0 encoding.y',
  ])
  expect(
    found([{ shape: 'bar', encoding: { y: 'score', glyph: 'triangle' } }]),
  ).toEqual(['warning unread-channel mark 0 encoding.glyph'])
})

test('a valued mark beside a packed span is told it stands in the first row, unless they never draw together or a facet bands them', () => {
  expect(problemsOf([COVERAGE, PILEUP]).map(problemText)).toEqual([
    'mark 0 encoding.row: stands in the first of the rows mark 1 bands the plot into, its axis repeated per row',
  ])
  expect(found([COVERAGE, PILEUP])).toEqual([
    'warning value-beside-rows mark 0 encoding.row',
  ])
  expect(
    found([
      { ...COVERAGE, minBpPerPx: 20 },
      { ...PILEUP, maxBpPerPx: 20 },
    ]),
  ).toEqual([])
  expect(found([COVERAGE, PILEUP], 'HP')).toEqual([])
})

test('two marks packing rows of their own are pointed at one shared pileup', () => {
  const filtered = (expr: string) => ({
    shape: 'span',
    transform: [{ type: 'filter', expr }, { type: 'pileup' }],
  })
  expect(found([filtered('jexl:a'), filtered('jexl:b')])).toEqual([
    'warning two-packings mark 1 transform',
  ])
})

test('a y the steps do not write names what they leave', () => {
  expect(
    problemsOf([
      {
        shape: 'bar',
        transform: [{ type: 'bin', step: 1000 }, { type: 'aggregate' }],
        encoding: { y: 'score' },
      },
    ]).map(problemText),
  ).toEqual([
    'mark 0 encoding.y: reads "score", which its steps do not write; they leave refName, start, end',
  ])
  expect(
    found([
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
    found([{ ...COVERAGE, encoding: { y: 'jexl:feature.coverage' } }]),
  ).toEqual([])
  expect(
    found([
      {
        shape: 'bar',
        transform: [{ type: 'coverage', as: 'depth' }],
        encoding: { y: 'coverage' },
      },
    ]),
  ).toEqual(['error unwritten-y mark 0 encoding.y'])
})

test('a step says which of its slots cannot run', () => {
  expect(
    found([
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
    'error step-expression mark 0 transform.0.expr',
    'error bin-width mark 0 transform.1.step',
    'error op-field mark 0 transform.2.ops.0.field',
  ])
})

test('a pair slot naming another number of fields says it reads the default', () => {
  expect(
    problemsOf([
      {
        shape: 'span',
        encoding: {},
        transform: [
          { type: 'bin', step: 10, as: ['lo'] },
          { type: 'pileup', fields: ['s', 'e', 'x'] },
        ],
      },
    ]).map(p => `${p.rule} ${p.slot}: ${p.message}`),
  ).toEqual([
    'step-pair transform.0.as: a bin reads two field names from as and this names 1, so it reads start and end',
    'step-pair transform.1.fields: a pileup reads two field names from fields and this names 3, so it reads start and end',
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
  expect(found(mean('INFO.DP'))).toEqual([])
  expect(found(mean('jexl:feature.INFO.DP[0]'))).toEqual([
    'error step-field-expression mark 0 transform.0.ops.0.field',
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
  expect(found(cuts([0.1, 0.5]))).toEqual([])
  expect(found(cuts(['0.5', '0.1']))).toEqual([
    'warning threshold-cuts mark 0 encoding.color.domain',
  ])
  expect(found(cuts(['low', 'high']))).toHaveLength(1)
  expect(found(cuts(['0.5', '0.5']))).toEqual([
    'warning threshold-cuts mark 0 encoding.color.domain',
  ])
})

test('a ramp domain is a pinned pair, and a span wants one', () => {
  const ramp = (shape: string, domain: unknown[]) => [
    {
      shape,
      encoding: {
        ...(shape === 'span' ? {} : { y: 'score' }),
        color: { field: 'score', ramp: ['white', 'red'], domain },
      },
    },
  ]
  expect(found(ramp('bar', [0, 10]))).toEqual([])
  expect(found(ramp('bar', [0]))).toEqual([
    'warning open-ramp-domain mark 0 encoding.color.domain',
  ])
  expect(found(ramp('span', []))).toEqual([
    'warning unpinned-span-ramp mark 0 encoding.color.domain',
  ])
})

test('a zoom range that admits no zoom never draws', () => {
  expect(
    problemsOf([
      {
        shape: 'bar',
        encoding: { y: 'score' },
        minBpPerPx: 100,
        maxBpPerPx: 20,
      },
    ]),
  ).toEqual([
    {
      rule: 'empty-zoom-range',
      level: 'error',
      mark: 0,
      slot: 'minBpPerPx',
      message: 'never draws: minBpPerPx 100 is not below maxBpPerPx 20',
    },
  ])
})

test('a density source on a span, or on a second mark, waits unread', () => {
  const density = { shape: 'bar', source: 'density', encoding: { y: 'count' } }
  expect(found([density, density])).toEqual([
    'warning second-density-mark mark 1 source',
  ])
  expect(found([{ shape: 'span', source: 'density' }])).toEqual([
    'warning span-density-source mark 0 source',
  ])
})

test('every rule of the list is reached by a case above', () => {
  expect([...reached].sort()).toEqual(
    [...Object.keys(MARK_RULES), 'mark-without-value'].sort(),
  )
})
