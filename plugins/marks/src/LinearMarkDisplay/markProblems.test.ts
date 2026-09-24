import fs from 'node:fs'

import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { configSchemaFactory, markRequirementProblems } from './configSchema.ts'
import { MARK_RULES, markProblems, problemText } from './markProblems.ts'

import type {
  FacetSnapshot,
  MarkProblem,
  MarkSnapshot,
  RowsSnapshot,
  StepSnapshot,
} from './markProblems.ts'

const schema = configSchemaFactory()
const reached = new Set<string>()

// The list as the display reads it: the schema's own lift, defaults left off.
function problemsOf(
  marks: unknown[],
  facet?: unknown,
  transform?: unknown[],
  rows?: unknown,
): MarkProblem[] {
  const snap: {
    marks?: MarkSnapshot[]
    facet?: FacetSnapshot
    transform?: StepSnapshot[]
    rows?: RowsSnapshot
  } = getSnapshot(
    schema.create({
      displayId: 'd',
      marks,
      ...(facet ? { facet } : {}),
      ...(transform ? { transform } : {}),
      ...(rows ? { rows } : {}),
    }),
  )
  const lifted = snap.marks ?? []
  const problems = [
    ...markRequirementProblems(lifted),
    ...markProblems(lifted, snap.facet, snap.transform, snap.rows),
  ]
  for (const { rule } of problems) {
    reached.add(rule)
  }
  return problems
}

function found(
  marks: unknown[],
  facet?: unknown,
  transform?: unknown[],
  rows?: unknown,
) {
  return problemsOf(marks, facet, transform, rows).map(
    p => `${p.level} ${p.rule} mark ${p.mark} ${p.slot}`,
  )
}

const COVERAGE = {
  mark: 'bar',
  transform: [{ type: 'coverage' }],
  encoding: { y: 'coverage' },
}
const PILEUP = { mark: 'span', transform: [{ type: 'pileup' }] }

interface ShippedConfig {
  tracks: {
    trackId: string
    displays?: {
      type: string
      marks?: unknown[]
      facet?: unknown
      transform?: unknown[]
      rows?: unknown
    }[]
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
      problemsOf(d.marks ?? [], d.facet, d.transform, d.rows).map(
        p => `${d.trackId}: ${problemText(p)}`,
      ),
    ),
  ).toEqual([])
})

test('the guide examples have no problems', () => {
  expect(
    found([
      { mark: 'bar', encoding: { y: 'score' }, maxBpPerPx: 100 },
      {
        mark: 'bar',
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
    problemsOf([{ mark: 'bar' }, { mark: 'point', encoding: {} }]),
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
  expect(found([{ mark: 'span' }])).toEqual([])
})

test('a channel the mark does not read waits unread', () => {
  expect(found([{ mark: 'span', encoding: { y: 'score' } }])).toEqual([
    'warning unread-channel mark 0 encoding.y',
  ])
  expect(
    found([{ mark: 'bar', encoding: { y: 'score', shape: 'triangle-down' } }]),
  ).toEqual(['warning unread-channel mark 0 encoding.shape'])
})

test('a size on a mark that draws no shape waits unread', () => {
  expect(found([{ mark: 'span', size: 8 }])).toEqual([
    'warning unread-size mark 0 size',
  ])
  expect(found([{ mark: 'point', size: 8, encoding: { y: 'score' } }])).toEqual(
    [],
  )
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
    mark: 'span',
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
        mark: 'bar',
        transform: [{ type: 'bin', step: 1000 }, { type: 'aggregate' }],
        encoding: { y: 'score' },
      },
    ]).map(problemText),
  ).toEqual([
    'mark 0 encoding.y: reads "score", which no step before it writes; they leave refName, start, end',
  ])
  expect(
    found([
      {
        mark: 'bar',
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
        mark: 'bar',
        transform: [{ type: 'coverage', as: 'depth' }],
        encoding: { y: 'coverage' },
      },
    ]),
  ).toEqual(['error unwritten-y mark 0 encoding.y'])
})

// The display's steps run before every mark's, so a field they make is one a
// mark may read, and a bin among them is the one a mark's empty groupby folds
// by.
test("a y the display's steps write is written, and one they unmake is not", () => {
  const binned = [
    { type: 'bin', step: 1000 },
    { type: 'aggregate', ops: [{ op: 'count' }] },
  ]
  expect(
    found([{ mark: 'bar', encoding: { y: 'count' } }], undefined, binned),
  ).toEqual([])
  expect(
    problemsOf(
      [{ mark: 'bar', encoding: { y: 'score' } }],
      undefined,
      binned,
    ).map(problemText),
  ).toEqual([
    'mark 0 encoding.y: reads "score", which no step before it writes; they leave refName, start, end, count',
  ])
  expect(
    found(
      [
        {
          mark: 'bar',
          transform: [{ type: 'aggregate', ops: [{ op: 'count' }] }],
          encoding: { y: 'count' },
        },
      ],
      undefined,
      [{ type: 'bin', step: 1000, as: ['lo', 'hi'] }],
    ),
  ).toEqual([])
})

test("a display pileup bands every mark, so none stands beside another's rows", () => {
  expect(
    found(
      [{ mark: 'bar', encoding: { y: 'score' } }, { mark: 'span' }],
      undefined,
      [{ type: 'pileup' }],
    ),
  ).toEqual([])
})

test('a step says which of its slots cannot run', () => {
  expect(
    found([
      {
        mark: 'bar',
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
        mark: 'span',
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
  const grouped = (field: string) => [
    {
      mark: 'bar',
      encoding: { y: 'count' },
      transform: [
        { type: 'aggregate', groupby: [field], ops: [{ op: 'count' }] },
      ],
    },
  ]
  expect(found(grouped('INFO.DP'))).toEqual([])
  expect(found(grouped('jexl:feature.INFO.DP[0]'))).toEqual([
    'error step-field-expression mark 0 transform.0.groupby.0',
  ])
})

test("the display's own steps are checked as a mark's are, under no mark", () => {
  const bar = { mark: 'bar', encoding: { y: 'score' } }
  const problems = problemsOf([bar], undefined, [
    { type: 'filter', expr: "get(feature,'score') > 1" },
    { type: 'bin', step: -5 },
    { type: 'pileup', fields: ['start'] },
    { type: 'aggregate', groupby: ['jexl:feature.x'], ops: [{ op: 'sum' }] },
  ])
  // the display's aggregate unmakes `score` for the mark under it
  expect(problems.map(p => `${p.rule} ${p.mark} ${p.slot}`)).toEqual([
    'step-expression undefined transform.0.expr',
    'bin-width undefined transform.1.step',
    'step-pair undefined transform.2.fields',
    'op-field undefined transform.3.ops.0.field',
    'step-field-expression undefined transform.3.groupby.0',
    'unwritten-y 0 encoding.y',
  ])
  expect(problemText(problems[1]!)).toBe(
    'transform.1.step: a bin is a positive width in bp',
  )
})

test('a mark the caller could not read keeps its index as a gap', () => {
  const packed: MarkSnapshot = {
    mark: 'span',
    transform: [{ type: 'pileup' }],
  }
  expect(
    markProblems([undefined, packed, packed]).map(
      p => `${p.rule} ${p.mark} ${p.message}`,
    ),
  ).toEqual([
    "two-packings 2 packs rows of its own, as mark 1 does, and the two share row numbers; one pileup in the display's transform packs them together",
  ])
})

test("two packings under a facet are pointed at the facet's transform", () => {
  expect(
    problemsOf([PILEUP, PILEUP], { field: 'HP' })
      .filter(p => p.rule === 'two-packings')
      .map(p => p.message),
  ).toEqual([
    "packs rows of its own, as mark 0 does, and the two share row numbers; one pileup in the facet's transform packs them together per section",
  ])
})

test("a mark packing over the facet's or the display's pileup is two packings", () => {
  expect(found([PILEUP], undefined, [{ type: 'pileup' }])).toEqual([
    'warning two-packings mark 0 transform',
  ])
  expect(
    found([PILEUP], { field: 'HP', transform: [{ type: 'pileup' }] }),
  ).toEqual(['warning two-packings mark 0 transform'])
})

test("a display pileup under a facet packs across every section, and the facet's is the fix", () => {
  expect(
    problemsOf([{ mark: 'span' }], { field: 'HP' }, [{ type: 'pileup' }]).map(
      problemText,
    ),
  ).toEqual([
    'transform.0: runs before the facet splits the features, so it packs across every section and leaves each section the rows the others fill; the same pileup in facet.transform packs each section on its own',
  ])
  expect(
    found([{ mark: 'span' }], {
      field: 'HP',
      transform: [{ type: 'pileup' }],
    }),
  ).toEqual([])
})

// The reviewer's case: a shared pileup bands the span, and the coverage bar's
// own step makes features that carry no row, so it stands beside the rows.
test('a mark whose own step unmakes a shared pileup stands beside the rows', () => {
  expect(
    found([COVERAGE, { mark: 'span' }], undefined, [{ type: 'pileup' }]),
  ).toEqual(['warning value-beside-rows mark 0 encoding.row'])
  expect(
    found(
      [{ mark: 'bar', encoding: { y: 'score' } }, { mark: 'span' }],
      undefined,
      [{ type: 'pileup' }],
    ),
  ).toEqual([])
})

test("the facet's steps are checked under facet.transform, and what they make a mark may read", () => {
  expect(
    found([{ mark: 'span' }], {
      field: 'HP',
      transform: [{ type: 'bin', step: -1 }],
    }),
  ).toEqual(['error bin-width mark undefined facet.transform.0.step'])
  expect(
    found([{ mark: 'bar', encoding: { y: 'count' } }], {
      field: 'HP',
      transform: [
        { type: 'bin', step: 1000 },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
    }),
  ).toEqual([])
})

test("a field the display's steps make is one a mark reads", () => {
  expect(
    found([{ mark: 'bar', encoding: { y: 'depth' } }], undefined, [
      { type: 'formula', expr: 'jexl:1', as: 'depth' },
    ]),
  ).toEqual([])
})

test('threshold cuts written high to low are told which way they are read', () => {
  const cuts = (domain: unknown[]) => [
    {
      mark: 'point',
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

test('a threshold range with other than one colour per interval is named', () => {
  const colors = (range: string[]) => [
    {
      mark: 'point',
      encoding: {
        y: 'score',
        color: { field: 'pip', scale: 'threshold', domain: [0.1, 0.5], range },
      },
    },
  ]
  expect(found(colors([]))).toEqual([])
  expect(found(colors(['red', 'orange', 'blue']))).toEqual([])
  expect(found(colors(['red', 'blue']))).toEqual([
    'warning threshold-range mark 0 encoding.color.range',
  ])
  expect(found(colors(['red', 'orange', 'blue', 'green']))).toHaveLength(1)
})

test('a ramp reads its ends, not a domain, and a span wants both ends pinned', () => {
  const ramp = (mark: string, color: Record<string, unknown>) => [
    {
      mark,
      encoding: {
        ...(mark === 'span' ? {} : { y: 'score' }),
        color: { field: 'score', scale: 'linear', ...color },
      },
    },
  ]
  expect(found(ramp('bar', { domainMin: 0, domainMax: 10 }))).toEqual([])
  expect(found(ramp('bar', { domainMin: 0 }))).toEqual([])
  expect(found(ramp('bar', { domain: ['0', '10'] }))).toEqual([
    'warning ramp-domain mark 0 encoding.color.domain',
  ])
  expect(found(ramp('bar', { domainMin: 10, domainMax: 0 }))).toEqual([
    'warning ramp-ends mark 0 encoding.color.domainMax',
  ])
  expect(found(ramp('span', { domainMin: 0 }))).toEqual([
    'warning unpinned-span-ramp mark 0 encoding.color.domainMax',
  ])
  expect(found(ramp('span', {}))).toEqual([
    'warning unpinned-span-ramp mark 0 encoding.color.domainMin',
  ])
  expect(found(ramp('span', { domainMin: 0, domainMax: 10 }))).toEqual([])
})

// A written range used to make an unset scale linear, so emptying it in the
// editor flipped the key to categorical with no message.
test('a range under an unset scale is categorical, whatever it lists', () => {
  const marks = [
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'score', range: ['white', 'red'], domain: ['0'] },
      },
    },
  ]
  expect(found(marks)).toEqual([])
})

test('a zoom range that admits no zoom never draws', () => {
  expect(
    problemsOf([
      {
        mark: 'bar',
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
  const density = { mark: 'bar', source: 'density', encoding: { y: 'count' } }
  expect(found([density, density])).toEqual([
    'warning second-density-mark mark 1 source',
  ])
  expect(found([{ mark: 'span', source: 'density' }])).toEqual([
    'warning span-density-source mark 0 source',
  ])
})

test('rows beside a facet is named as not drawn yet, and the facet draws', () => {
  const BAR = { mark: 'bar', encoding: { y: 'score' } }
  expect(found([BAR], undefined, undefined, 'source')).toEqual([])
  expect(
    problemsOf([BAR], 'tissue', undefined, 'source').map(problemText),
  ).toEqual([
    'rows.field: facet stacks a labelled section per value and rows one row per value; bands of rows, the two at once, are not drawn yet, so the facet draws alone',
  ])
})

test("a pileup under rows is told its packed rows share their value's row", () => {
  const BAR = { mark: 'bar', encoding: { y: 'score' } }
  expect(
    found(
      [BAR, PILEUP, { mark: 'span', encoding: { row: 'lane' } }],
      { transform: [{ type: 'pileup' }] },
      [{ type: 'pileup' }],
      'source',
    ),
  ).toEqual([
    'warning packing-under-rows mark undefined transform.0',
    'warning packing-under-rows mark undefined facet.transform.0',
    'warning packing-under-rows mark 1 transform.0',
    'warning packing-under-rows mark 2 encoding.row',
    'warning two-packings mark 1 transform',
  ])
  expect(found([BAR, PILEUP], 'HP', undefined, 'source')).toContain(
    'warning rows-beside-facet mark undefined rows.field',
  )
  expect(found([BAR, PILEUP], 'HP', undefined, 'source')).not.toContain(
    'warning packing-under-rows mark 1 transform.0',
  )
})

test('every rule of the list is reached by a case above', () => {
  expect([...reached].sort()).toEqual(
    [...Object.keys(MARK_RULES), 'mark-without-value'].sort(),
  )
})
