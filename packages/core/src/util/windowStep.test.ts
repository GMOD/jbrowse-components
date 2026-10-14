import { layerTables, runTransforms } from './featureTransforms.ts'
import SimpleFeature from './simpleFeature.ts'

import type { FeatureTable } from './featureTable.ts'
import type { AggregateOp, WindowStep } from './markEncodingTypes.ts'

function feature(start: number, rest: Record<string, unknown> = {}) {
  return new SimpleFeature({
    uniqueId: `${rest.source ?? ''}${start}`,
    refName: 'ctgA',
    start,
    end: start + 1,
    ...rest,
  })
}

function read(table: FeatureTable, ...fields: string[]) {
  return Array.from({ length: table.length }, (_, i) => {
    const f = table.row(i)
    return fields.map(field => f.get(field))
  })
}

test('a centred frame averages its rows, a cut-off one the rows it has', () => {
  const out = runTransforms(
    [0, 10, 20, 30, 40].map((start, i) => feature(start, { score: i * 10 })),
    [
      {
        type: 'window',
        frame: [-1, 1],
        ops: [{ op: 'mean', field: 'score', as: 'smooth' }],
      },
    ],
  )
  expect(read(out, 'start', 'smooth')).toEqual([
    [0, 5],
    [10, 10],
    [20, 20],
    [30, 30],
    [40, 35],
  ])
})

test('the default frame reads ten rows either side', () => {
  const n = 30
  const out = runTransforms(
    Array.from({ length: n }, (_, i) => feature(i * 10, { score: 1 })),
    [{ type: 'window', ops: [{ op: 'count' }] }],
  )
  expect(read(out, 'count').map(([c]) => c)).toEqual(
    Array.from(
      { length: n },
      (_, i) => Math.min(i, 10) + Math.min(n - 1 - i, 10) + 1,
    ),
  )
})

test('a frame open before its row is a running total', () => {
  const out = runTransforms(
    [0, 10, 20].map(start => feature(start, { score: 2 })),
    [
      {
        type: 'window',
        frame: [null, 0],
        ops: [{ op: 'sum', field: 'score' }],
      },
    ],
  )
  expect(read(out, 'sum_score')).toEqual([[2], [4], [6]])
})

test('groups come out apart, each in start order, and never share a frame', () => {
  const out = runTransforms(
    [
      feature(20, { source: 'a', score: 3 }),
      feature(0, { source: 'b', score: 100 }),
      feature(0, { source: 'a', score: 1 }),
      feature(10, { source: 'a', score: 2 }),
      feature(10, { source: 'b', score: 200 }),
    ],
    [
      {
        type: 'window',
        groupby: ['source'],
        frame: [null, null],
        ops: [{ op: 'max', field: 'score', as: 'top' }],
      },
    ],
  )
  expect(read(out, 'source', 'start', 'top')).toEqual([
    ['a', 0, 3],
    ['a', 10, 3],
    ['a', 20, 3],
    ['b', 0, 200],
    ['b', 10, 200],
  ])
})

test('a weight counts each row by it, and a frame with nothing readable answers nothing', () => {
  const out = runTransforms(
    [
      feature(0, { frac: 1, depth: 30 }),
      feature(10, { frac: 0, depth: 10 }),
      feature(20, { depth: 5 }),
      feature(30, { depth: 5 }),
    ],
    [
      {
        type: 'window',
        frame: [0, 1],
        ops: [{ op: 'mean', field: 'frac', weight: 'depth', as: 'meth' }],
      },
    ],
  )
  expect(read(out, 'meth')).toEqual([[0.75], [0], [undefined], [undefined]])
})

test('a window behind a bin and an aggregate smooths the bins', () => {
  const out = runTransforms(
    [0, 5, 10, 15, 20, 25].map((start, i) => feature(start, { score: i })),
    [
      { type: 'bin', step: 10, as: ['bs', 'be'] },
      {
        type: 'aggregate',
        groupby: ['bs', 'be'],
        ops: [{ op: 'mean', field: 'score', as: 'binned' }],
      },
      {
        type: 'window',
        frame: [-1, 1],
        ops: [{ op: 'mean', field: 'binned', as: 'smooth' }],
      },
    ],
  )
  expect(read(out, 'binned', 'smooth')).toEqual([
    [0.5, 1.5],
    [2.5, 2.5],
    [4.5, 3.5],
  ])
})

test('under a facet each section is windowed alone', () => {
  const { layers } = layerTables(
    [
      feature(0, { source: 'a', score: 1 }),
      feature(10, { source: 'a', score: 1 }),
      feature(0, { source: 'b', score: 5 }),
      feature(10, { source: 'b', score: 5 }),
    ],
    {
      facet: { field: 'source' },
      layers: [
        {
          transform: [
            {
              type: 'window',
              frame: [null, null],
              ops: [{ op: 'sum', field: 'score', as: 'total' }],
            },
          ],
        },
      ],
    },
  )
  expect(read(layers[0]!.table, 'source', 'total')).toEqual([
    ['a', 2],
    ['a', 2],
    ['b', 10],
    ['b', 10],
  ])
})

// Every op over every frame shape against a direct reading of the definition,
// on rows out of start order with unreadable values and weights among them.
test('each op over each frame agrees with summing the frame row by row', () => {
  let seed = 7
  const next = () => {
    seed = (seed * 48271) % 2147483647
    return seed / 2147483647
  }
  const features = Array.from({ length: 60 }, (_, i) =>
    feature(Math.floor(next() * 1000), {
      score: next() < 0.15 ? 'n/a' : Math.round(next() * 100) - 30,
      depth: next() < 0.1 ? undefined : Math.ceil(next() * 20),
      source: next() < 0.5 ? 'a' : 'b',
      i,
    }),
  )
  const frames: WindowStep['frame'][] = [
    [-3, 3],
    [null, 0],
    [0, null],
    [-5, -2],
    [2, 4],
    [null, null],
    [4, 2],
  ]
  const ops: AggregateOp[] = [
    { op: 'count', as: 'count' },
    { op: 'count', weight: 'depth', as: 'wcount' },
    { op: 'sum', field: 'score', as: 'sum' },
    { op: 'mean', field: 'score', as: 'mean' },
    { op: 'mean', field: 'score', weight: 'depth', as: 'wmean' },
    { op: 'min', field: 'score', as: 'min' },
    { op: 'max', field: 'score', as: 'max' },
  ]
  for (const frame of frames) {
    const out = runTransforms(features, [
      { type: 'window', groupby: ['source'], frame, ops },
    ])
    const got = read(out, 'source', 'i', ...ops.map(o => o.as!))
    const want = ['a', 'b'].flatMap(source => {
      const group = features
        .filter(f => f.get('source') === source)
        .sort(
          (x, y) =>
            Number(x.get('start')) - Number(y.get('start')) ||
            Number(x.get('i')) - Number(y.get('i')),
        )
      return group.map((f, j) => {
        const [before, after] = frame!
        const a = before === null ? 0 : Math.max(0, j + before)
        const b =
          after === null
            ? group.length - 1
            : Math.min(group.length - 1, j + after)
        const inFrame = a > b ? [] : group.slice(a, b + 1)
        const num = (x: unknown) => (typeof x === 'number' ? x : Number.NaN)
        const scored = inFrame.filter(g => Number.isFinite(num(g.get('score'))))
        const weighted = scored.filter(g =>
          Number.isFinite(num(g.get('depth'))),
        )
        const sumOf = (rows: typeof inFrame, w: (g: SimpleFeature) => number) =>
          rows.reduce((acc, g) => acc + num(g.get('score')) * w(g), 0)
        const wTotal = weighted.reduce((acc, g) => acc + num(g.get('depth')), 0)
        const values = scored.map(g => num(g.get('score')))
        return [
          source,
          f.get('i'),
          inFrame.length,
          inFrame
            .filter(g => Number.isFinite(num(g.get('depth'))))
            .reduce((acc, g) => acc + num(g.get('depth')), 0),
          sumOf(scored, () => 1),
          scored.length ? sumOf(scored, () => 1) / scored.length : undefined,
          wTotal
            ? sumOf(weighted, g => num(g.get('depth'))) / wTotal
            : undefined,
          values.length ? Math.min(...values) : undefined,
          values.length ? Math.max(...values) : undefined,
        ]
      })
    })
    expect(got.length).toBe(want.length)
    for (const [r, row] of got.entries()) {
      for (const [c, value] of row.entries()) {
        const expected = want[r]![c]
        if (typeof expected === 'number') {
          expect(value).toBeCloseTo(expected, 9)
        } else {
          expect(value).toBe(expected)
        }
      }
    }
  }
})
