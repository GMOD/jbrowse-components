import {
  compilePredicates,
  lowerBoundOf,
  unreadFields,
  unreadInEveryRegion,
  unreadRecordFields,
  withLowerBound,
} from './fieldPredicate.ts'

import type { FieldPredicate, PredicateLane } from './fieldPredicate.ts'

function admitted(
  predicates: FieldPredicate[],
  lanes: Record<string, PredicateLane>,
  count: number,
) {
  const test = compilePredicates(predicates, f => lanes[f])
  return Array.from({ length: count }, (_, i) => i).filter(
    i => test?.(i) ?? true,
  )
}

const identity: PredicateLane = {
  kind: 'number',
  values: Float32Array.from([0.5, 0.9, Number.NaN, 0.95]),
}

test('an empty list, or a predicate naming no test, compiles to nothing', () => {
  expect(compilePredicates([], () => undefined)).toBeUndefined()
  expect(compilePredicates([{ field: 'x' }], () => undefined)).toBeUndefined()
})

test('a comparison on a missing value is false', () => {
  expect(admitted([{ field: 'identity', gte: 0.9 }], { identity }, 4)).toEqual([
    1, 3,
  ])
})

// 0.9 stored in a Float32Array reads back below the Float64 0.9
test('a Float32 lane compares at its own precision', () => {
  expect(
    admitted([{ field: 'identity', equal: 0.9 }], { identity }, 4),
  ).toEqual([1])
})

test('valid selects present or missing values', () => {
  expect(
    admitted([{ field: 'identity', valid: true }], { identity }, 4),
  ).toEqual([0, 1, 3])
  expect(
    admitted([{ field: 'identity', valid: false }], { identity }, 4),
  ).toEqual([2])
})

test('a field no lane carries is missing on every record', () => {
  expect(admitted([{ field: 'dnds', gte: 1 }], {}, 3)).toEqual([])
  expect(admitted([{ field: 'dnds', valid: false }], {}, 3)).toEqual([0, 1, 2])
})

test('gt and lt are open, gte and lte closed, and both ends hold', () => {
  const lane: PredicateLane = {
    kind: 'number',
    values: Float64Array.from([1, 2, 3, 4]),
  }
  expect(admitted([{ field: 'n', gt: 1, lte: 3 }], { n: lane }, 4)).toEqual([
    1, 2,
  ])
  expect(admitted([{ field: 'n', gte: 2, lt: 4 }], { n: lane }, 4)).toEqual([
    1, 2,
  ])
})

test('every predicate in the list must hold', () => {
  const length: PredicateLane = {
    kind: 'number',
    values: Float64Array.from([100, 20000, 30000, 50]),
  }
  expect(
    admitted(
      [
        { field: 'length', gte: 10000 },
        { field: 'identity', gte: 0.9 },
      ],
      { identity, length },
      4,
    ),
  ).toEqual([1])
})

test('oneOf and equal over a dictionary-coded lane', () => {
  const group: PredicateLane = {
    kind: 'labels',
    ids: Int32Array.from([0, 1, -1, 2]),
    labels: ['A1a', 'B1', 'C2'],
  }
  expect(
    admitted([{ field: 'group', oneOf: ['A1a', 'C2'] }], { group }, 4),
  ).toEqual([0, 3])
  expect(admitted([{ field: 'group', equal: 'B1' }], { group }, 4)).toEqual([1])
  expect(admitted([{ field: 'group', valid: false }], { group }, 4)).toEqual([
    2,
  ])
})

test('an object lane compares in the type of the constant', () => {
  const records = [{ score: '12' }, { score: '3' }, {}, { score: 40 }]
  const score: PredicateLane = {
    kind: 'get',
    get: i => (records[i] as Record<string, unknown>).score,
  }
  expect(admitted([{ field: 'score', gte: 10 }], { score }, 4)).toEqual([0, 3])
  expect(admitted([{ field: 'score', equal: '3' }], { score }, 4)).toEqual([1])
})

test('a boolean field takes equal: false', () => {
  const records = [true, false, undefined]
  const duplicate: PredicateLane = { kind: 'get', get: i => records[i] }
  expect(
    admitted([{ field: 'duplicate', equal: false }], { duplicate }, 3),
  ).toEqual([1])
})

test('equal tests on the bits of one word fuse into one mask compare', () => {
  const flags = [0, 4, 1024, 16, 1028]
  const word = (i: number) => flags[i]!
  const lanes: Record<string, PredicateLane> = {
    unmapped: { kind: 'bits', word, mask: 4 },
    duplicate: { kind: 'bits', word, mask: 1024 },
    reverse: { kind: 'bits', word, mask: 16 },
  }
  expect(
    admitted(
      [
        { field: 'unmapped', equal: false },
        { field: 'duplicate', equal: false },
      ],
      lanes,
      5,
    ),
  ).toEqual([0, 3])
  expect(admitted([{ field: 'reverse', equal: true }], lanes, 5)).toEqual([3])
  // oneOf both values is not a fusable equal, and passes every record
  expect(
    admitted([{ field: 'reverse', oneOf: [true, false] }], lanes, 5),
  ).toEqual([0, 1, 2, 3, 4])
})

describe('the slider helpers', () => {
  const list: FieldPredicate[] = [
    { field: 'length', gte: 1000, lte: 5000 },
    { field: 'identity', gte: 0.9 },
  ]

  test('lowerBoundOf reads the tightest gte or gt', () => {
    expect(lowerBoundOf(list, 'length')).toBe(1000)
    expect(lowerBoundOf(list, 'dnds')).toBeUndefined()
  })

  test('withLowerBound rewrites the bound and keeps the other tests', () => {
    expect(withLowerBound(list, 'length', 2000)).toEqual([
      { field: 'length', lte: 5000, gte: 2000 },
      { field: 'identity', gte: 0.9 },
    ])
  })

  test('withLowerBound drops a predicate it leaves testing nothing', () => {
    expect(withLowerBound(list, 'identity', undefined)).toEqual([list[0]])
  })

  test('withLowerBound appends a predicate for a field not yet tested', () => {
    expect(withLowerBound([], 'length', 10000)).toEqual([
      { field: 'length', gte: 10000 },
    ])
  })
})

describe('a value no number reads as fails every comparison', () => {
  // a VCF's DP=. arrives as [undefined]
  const values: unknown[] = [5, 0, '', ' ', [], [undefined], null, 'NA', '5']
  const lane: PredicateLane = { kind: 'get', get: i => values[i] }
  const admits = (p: FieldPredicate) =>
    admitted([p], { v: lane }, values.length).map(i => values[i])

  test('bounds and equal admit numbers alone', () => {
    expect(admits({ field: 'v', gte: 0 })).toEqual([5, 0, '5'])
    expect(admits({ field: 'v', lte: 10 })).toEqual([5, 0, '5'])
    expect(admits({ field: 'v', equal: 0 })).toEqual([0])
  })

  test('valid splits the missing values from the rest', () => {
    expect(admits({ field: 'v', valid: false })).toEqual([
      '',
      [],
      [undefined],
      null,
    ])
    expect(admits({ field: 'v', valid: true })).toEqual([5, 0, ' ', 'NA', '5'])
  })

  test('oneOf compares each member in its own type', () => {
    expect(admits({ field: 'v', oneOf: [5, 'NA'] })).toEqual([5, 'NA', '5'])
  })

  test('equal: false admits false, not a missing value or 0', () => {
    const flags = [false, 'false', true, 0, '', undefined]
    expect(
      admitted(
        [{ field: 'f', equal: false }],
        { f: { kind: 'get', get: i => flags[i] } },
        flags.length,
      ),
    ).toEqual([0, 1])
  })

  test('a labels lane answers as a get lane does', () => {
    const labels = ['5', '0', '', ' ', 'NA']
    const labelsLane: PredicateLane = {
      kind: 'labels',
      ids: Int32Array.from([0, 1, 2, 3, 4, -1]),
      labels,
    }
    const getLane: PredicateLane = {
      kind: 'get',
      get: i => [...labels, undefined][i],
    }
    for (const p of [
      { field: 'v', gte: 0 },
      { field: 'v', valid: false },
      { field: 'v', valid: true },
      { field: 'v', oneOf: [0, 'NA'] },
    ]) {
      expect(admitted([p], { v: labelsLane }, 6)).toEqual(
        admitted([p], { v: getLane }, 6),
      )
    }
  })

  test("a number lane matches no text member, and '' is not 0", () => {
    const n: PredicateLane = {
      kind: 'number',
      values: Float64Array.from([0, 1, Number.NaN]),
    }
    expect(admitted([{ field: 'n', equal: '' }], { n }, 3)).toEqual([])
    expect(admitted([{ field: 'n', oneOf: [1, 'x'] }], { n }, 3)).toEqual([1])
  })
})

test('a field no record holds is unread, unless its entry selects missing values or tests nothing', () => {
  const held = new Set(['score'])
  expect(
    unreadFields(
      [
        { field: 'score', gt: 5 },
        { field: 'scroe', gt: 5 },
        { field: 'scroe', lt: 9 },
        { field: 'strand', valid: false },
        { field: 'name' },
      ],
      field => held.has(field),
    ),
  ).toEqual(['scroe'])
})

test('a field is unread only where every region that fetched records found it so', () => {
  expect(unreadInEveryRegion([['a', 'b'], undefined, ['b']])).toEqual(['b'])
  expect(unreadInEveryRegion([['a'], []])).toEqual([])
  expect(unreadInEveryRegion([undefined])).toEqual([])
})

describe('unreadRecordFields', () => {
  const filter = [
    { field: 'scroe', gt: 5 },
    { field: 'score', gt: 50 },
    { field: 'geneLike', equal: true },
    { field: "jexl:get(feature,'nope')", equal: true },
  ]
  const record = (values: Record<string, unknown>) => ({
    get: (field: string) => values[field],
  })
  const fetched = [record({ score: 10 }), record({})]
  const computed = (field: string) => field === 'geneLike'

  test('names a field no record carries once the filter kept none', () => {
    expect(unreadRecordFields(filter, fetched, 0, computed)).toEqual(['scroe'])
  })

  test('reads nothing while the filter kept a record, and is undefined with none fetched', () => {
    expect(unreadRecordFields(filter, fetched, 1, computed)).toEqual([])
    expect(unreadRecordFields(filter, [], 0, computed)).toBeUndefined()
  })
})
