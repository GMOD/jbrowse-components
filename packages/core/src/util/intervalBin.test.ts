import * as kernel from './binnedAggregate.ts'
import { valueAt } from './featureTable.ts'
import { facetLayers, layerTables, runTransforms } from './featureTransforms.ts'
import SimpleFeature from './simpleFeature.ts'

import type { FeatureTable } from './featureTable.ts'
import type {
  AggregateStep,
  BinStep,
  TransformStep,
} from './markEncodingTypes.ts'

function feature(
  start: number,
  end: number,
  rest: Record<string, unknown> = {},
) {
  return new SimpleFeature({
    uniqueId: `${start}-${end}`,
    refName: 'ctgA',
    start,
    end,
    ...rest,
  })
}

function rows(table: FeatureTable, ...fields: string[]) {
  return Array.from({ length: table.length }, (_, i) =>
    fields.map(field => table.row(i).get(field)),
  )
}

const INTERVAL_BIN: BinStep = {
  type: 'bin',
  step: 10,
  fields: ['start', 'end'],
}

test('a bin over fields cuts each interval at the bin edges, one piece per bin it overlaps', () => {
  const out = runTransforms(
    [
      feature(5, 27, { score: 2 }),
      feature(30, 30, { score: 4 }),
      feature(40, 45),
    ],
    [INTERVAL_BIN],
  )
  expect(
    runTransforms(
      [feature(0, 5, { to: 'x' }), feature(8, 9, { to: 3 })],
      [{ type: 'bin', step: 10, fields: ['start', 'to'] }],
    ).length,
  ).toBe(0)
  expect(rows(out, 'start', 'end', 'overlap', 'score')).toEqual([
    [0, 10, 5, 2],
    [10, 20, 10, 2],
    [20, 30, 7, 2],
    [30, 40, 0, 4],
    [40, 50, 5, undefined],
  ])
  expect(out.row(1).id()).toBe('5-27')
  expect(out.row(1).toJSON()).toMatchObject({
    uniqueId: '5-27',
    start: 10,
    end: 20,
    overlap: 10,
    score: 2,
  })
})

test('a piece stands where its feature stands: `as` renames the edges, and its parent is its feature’s', () => {
  const block = feature(0, 20, {
    alignments: { a: { seq: 'x' } },
  })
  const out = runTransforms(
    [block],
    [
      { type: 'flatten', field: 'alignments', key: 'species' },
      { type: 'bin', step: 10, fields: ['start', 'end'], as: ['lo', 'hi'] },
    ],
  )
  expect(rows(out, 'start', 'end', 'lo', 'hi', 'overlap', 'species')).toEqual([
    [0, 20, 0, 10, 10, 'a'],
    [0, 20, 10, 20, 10, 'a'],
  ])
  expect(out.row(0).parent?.()?.id()).toBe(block.id())
})

test('a weight makes a count its sum, a sum of products and a mean over it, and moves no min or max', () => {
  const out = runTransforms(
    [
      feature(0, 1, { v: 1, w: 3 }),
      feature(1, 2, { v: 5, w: 1 }),
      feature(2, 3, { v: 100, w: 'x' }),
      feature(3, 4, { v: 'x', w: 7 }),
    ],
    [
      {
        type: 'aggregate',
        ops: [
          { op: 'count', weight: 'w', as: 'n' },
          { op: 'sum', field: 'v', weight: 'w', as: 'sum' },
          { op: 'mean', field: 'v', weight: 'w', as: 'mean' },
          { op: 'mean', field: 'v', as: 'plain' },
          { op: 'min', field: 'v', weight: 'w', as: 'min' },
          { op: 'max', field: 'v', weight: 'w', as: 'max' },
        ],
      },
    ],
  )
  expect(rows(out, 'n', 'sum', 'mean', 'plain', 'min', 'max')).toEqual([
    [11, 8, 2, 106 / 3, 1, 100],
  ])
})

test('an interval bin and a mean weighted by overlap answer the mean per base', () => {
  const out = runTransforms(
    [feature(0, 15, { match: 1 }), feature(15, 20, { match: 0 })],
    [
      INTERVAL_BIN,
      {
        type: 'aggregate',
        groupby: ['start', 'end'],
        ops: [{ op: 'mean', field: 'match', weight: 'overlap', as: 'id' }],
      },
    ],
  )
  expect(rows(out, 'start', 'end', 'id')).toEqual([
    [0, 10, 1],
    [10, 20, 0.5],
  ])
})

// A deterministic LCG, its high bits taken, so a fixture is the same every
// run.
function random(seed: number) {
  let state = seed
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function intervals(count: number, seed: number) {
  const next = random(seed)
  return Array.from({ length: count }, (_, i) => {
    const from = Math.floor(next() * 400)
    const roll = next()
    const to =
      roll < 0.1
        ? from
        : roll < 0.13
          ? 'none'
          : roll < 0.15
            ? from - 3
            : from + Math.floor(next() * 60)
    return new SimpleFeature({
      uniqueId: `f${i}`,
      refName: 'ctgA',
      start: from,
      end: from + 1,
      from,
      to,
      species: ['a', 'b', 'c'][Math.floor(next() * 3)],
      v: next() < 0.1 ? 'x' : Math.round(next() * 1000) / 7,
      w: next() < 0.1 ? undefined : Math.round(next() * 50) / 3,
    })
  })
}

const OPS: AggregateStep['ops'] = [
  { op: 'count' },
  { op: 'count', weight: 'overlap', as: 'bases' },
  { op: 'count', weight: 'w', as: 'wn' },
  { op: 'sum', field: 'v', weight: 'overlap', as: 'sum' },
  { op: 'mean', field: 'v', weight: 'overlap', as: 'mean' },
  { op: 'mean', field: 'v', weight: 'w', as: 'meanW' },
  { op: 'mean', field: 'overlap', as: 'meanOverlap' },
  { op: 'mean', field: 'v' },
  { op: 'min', field: 'v', weight: 'overlap' },
  { op: 'max', field: 'start', as: 'top' },
]

function declarations(): [BinStep, AggregateStep][] {
  return [
    [
      { type: 'bin', step: 10, fields: ['from', 'to'] },
      { type: 'aggregate', groupby: ['start', 'end'], ops: OPS },
    ],
    [
      { type: 'bin', step: 2.5, fields: ['from', 'to'] },
      { type: 'aggregate', groupby: ['end', 'start'], ops: OPS },
    ],
    [
      { type: 'bin', step: 64, fields: ['from', 'to'], as: ['lo', 'hi'] },
      { type: 'aggregate', groupby: ['lo', 'hi'], ops: OPS },
    ],
  ]
}

function answers(table: FeatureTable, fields: readonly string[]) {
  return Array.from({ length: table.length }, (_, i) => {
    const row = table.row(i)
    return {
      id: row.id(),
      json: row.toJSON(),
      values: fields.map(field => valueAt(table.column(field), i)),
    }
  })
}

const FIELDS = [
  'refName',
  'start',
  'end',
  'lo',
  'hi',
  'count',
  'bases',
  'wn',
  'sum',
  'mean',
  'meanW',
  'meanOverlap',
  'mean_v',
  'min_v',
  'top',
]

// The two steps run as one kernel only where they stand together in one
// list; run apart, each is its own step. Each must answer the other's rows,
// ids, hover and order, to the bit.
test('an interval bin fused with its aggregate answers what the two steps answer apart', () => {
  const input = intervals(3000, 7)
  const kernelRuns = jest.spyOn(kernel, 'binnedAggregate')
  for (const [binStep, agg] of declarations()) {
    expect(kernel.fusesBinAggregate(binStep, agg)).toBe(true)
    kernelRuns.mockClear()
    const fused = runTransforms(input, [binStep, agg])
    expect(kernelRuns).toHaveBeenCalledTimes(1)
    expect(kernelRuns.mock.results[0]!.value).toBeDefined()
    const apart = runTransforms(runTransforms(input, [binStep]), [agg])
    expect(kernelRuns).toHaveBeenCalledTimes(1)
    expect(fused.length).toBeGreaterThan(5)
    expect(answers(fused, FIELDS)).toEqual(answers(apart, FIELDS))
  }
  kernelRuns.mockRestore()
})

test('under a facet the fused kernel groups within each section, in section order', () => {
  const input = intervals(3000, 11)
  const kernelRuns = jest.spyOn(kernel, 'binnedAggregate')
  for (const [binStep, agg] of declarations()) {
    kernelRuns.mockClear()
    const fused = facetLayers(input, { field: 'species' }, [
      { transform: [binStep, agg] },
    ])
    const apart = facetLayers(
      input,
      { field: 'species', transform: [binStep] },
      [{ transform: [agg] }],
    )
    expect(kernelRuns).toHaveBeenCalledTimes(1)
    expect(kernelRuns.mock.results[0]!.value).toBeDefined()
    expect(fused.sections).toEqual(apart.sections)
    const [f] = fused.layers
    const [a] = apart.layers
    expect([...f!.rows]).toEqual([...a!.rows])
    expect(answers(f!.table, FIELDS)).toEqual(answers(a!.table, FIELDS))
  }
  kernelRuns.mockRestore()
})

test('the display’s own steps split under a facet as they do unfused, an interval bin writing overlap', () => {
  const input = intervals(500, 3)
  const [binStep, agg] = declarations()[0]!
  const transform: TransformStep[] = [binStep]
  const facet = { field: 'species' }
  const early = layerTables(input, {
    transform,
    facet,
    layers: [{ transform: [agg] }],
  })
  const late = facetLayers(runTransforms(input, transform), facet, [
    { transform: [agg] },
  ])
  expect(answers(early.layers[0]!.table, FIELDS)).toEqual(
    answers(late.layers[0]!.table, FIELDS),
  )
})

test('rows spread too thinly for a dense bin index still answer the two steps’ rows', () => {
  const input = [
    feature(0, 3, { v: 1 }),
    feature(5_000_000, 5_000_004, { v: 3 }),
    feature(1, 2, { v: 2 }),
  ]
  const binStep: BinStep = { type: 'bin', step: 1, fields: ['start', 'end'] }
  const agg: AggregateStep = {
    type: 'aggregate',
    groupby: ['start', 'end'],
    ops: [{ op: 'mean', field: 'v', weight: 'overlap' }],
  }
  const kernelRuns = jest.spyOn(kernel, 'binnedAggregate')
  const fused = runTransforms(input, [binStep, agg])
  expect(kernelRuns).toHaveBeenCalledTimes(1)
  expect(kernelRuns.mock.results[0]!.value).toBeUndefined()
  kernelRuns.mockRestore()
  const apart = runTransforms(runTransforms(input, [binStep]), [agg])
  expect(answers(fused, ['start', 'mean_v'])).toEqual(
    answers(apart, ['start', 'mean_v']),
  )
  expect(rows(fused, 'start', 'mean_v')).toEqual([
    [0, 1],
    [1, 1.5],
    [2, 1],
    [5_000_000, 3],
    [5_000_001, 3],
    [5_000_002, 3],
    [5_000_003, 3],
  ])
})

test('the kernel fuses only a groupby of the bin’s two edges over plain fields', () => {
  const agg = (
    groupby: string[],
    ops: AggregateStep['ops'] = [{ op: 'count' }],
  ) => ({ type: 'aggregate', groupby, ops }) as AggregateStep
  expect(
    kernel.fusesBinAggregate({ type: 'bin', step: 10 }, agg(['start', 'end'])),
  ).toBe(false)
  expect(kernel.fusesBinAggregate(INTERVAL_BIN, agg(['start']))).toBe(false)
  expect(
    kernel.fusesBinAggregate(INTERVAL_BIN, agg(['start', 'species'])),
  ).toBe(false)
  expect(
    kernel.fusesBinAggregate(
      INTERVAL_BIN,
      agg(['start', 'end'], [{ op: 'mean', field: 'INFO.DP' }]),
    ),
  ).toBe(false)
})
