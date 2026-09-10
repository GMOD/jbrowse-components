import { runTransforms } from './featureTransforms.ts'
import createJexlInstance from './jexl.ts'
import { placeRect } from './layouts/placeRect.ts'
import SimpleFeature from './simpleFeature.ts'

import type { Feature } from './simpleFeature.ts'

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

function rows(features: readonly Feature[], ...fields: string[]) {
  return features.map(f => fields.map(field => f.get(field)))
}

const jexl = createJexlInstance()

test('formula writes a field every later step reads', () => {
  const out = runTransforms(
    [feature(0, 10, { score: 4 })],
    [
      { type: 'formula', expr: "jexl:get(feature,'score') * 2", as: 'twice' },
      { type: 'filter', expr: "jexl:get(feature,'twice') > 5" },
    ],
    jexl,
  )
  expect(rows(out, 'twice', 'score')).toEqual([[8, 4]])
  expect(out[0]!.toJSON()).toMatchObject({ twice: 8, score: 4, start: 0 })
})

test('bin snaps start and end to the genome-aligned bin, and aggregate counts per bin', () => {
  const out = runTransforms(
    [
      feature(5, 8, { score: 1 }),
      feature(12, 30, { score: 3 }),
      feature(19, 21, { score: 5 }),
      feature(40, 41, { score: 'x' }),
    ],
    [
      { type: 'bin', step: 10 },
      {
        type: 'aggregate',
        groupby: ['start', 'end'],
        ops: [
          { op: 'count' },
          { op: 'mean', field: 'score' },
          { op: 'max', field: 'score', as: 'top' },
        ],
      },
    ],
  )
  expect(rows(out, 'start', 'end', 'count', 'mean_score', 'top')).toEqual([
    [0, 10, 1, 1, 1],
    [10, 20, 2, 4, 5],
    [40, 50, 1, undefined, undefined],
  ])
  expect(new Set(out.map(f => f.id())).size).toBe(3)
})

test('bin places a feature by the field named and writes the edges where as says', () => {
  const out = runTransforms(
    [feature(3, 27)],
    [{ type: 'bin', step: 10, field: 'end', as: ['b0', 'b1'] }],
  )
  expect(rows(out, 'start', 'end', 'b0', 'b1')).toEqual([[3, 27, 20, 30]])
})

test('aggregate with no groupby summarises the whole list over its extent', () => {
  const out = runTransforms(
    [feature(5, 8, { score: 2 }), feature(50, 60, { score: 4 })],
    [{ type: 'aggregate', ops: [{ op: 'sum', field: 'score' }] }],
  )
  expect(rows(out, 'start', 'end', 'sum_score')).toEqual([[5, 60, 6]])
})

test('coverage is one feature per run of constant depth, zero runs left out', () => {
  const out = runTransforms(
    [feature(10, 30), feature(0, 20), feature(50, 60), feature(50, 60)],
    [{ type: 'coverage' }],
  )
  expect(rows(out, 'start', 'end', 'coverage')).toEqual([
    [0, 10, 1],
    [10, 20, 2],
    [20, 30, 1],
    [50, 60, 2],
  ])
})

test('coverage over nothing is nothing, and a named field carries the depth', () => {
  expect(runTransforms([], [{ type: 'coverage' }])).toEqual([])
  const out = runTransforms(
    [feature(0, 5)],
    [{ type: 'coverage', as: 'depth' }],
  )
  expect(rows(out, 'depth')).toEqual([[1]])
})

test('a jexl step without an instance says so', () => {
  expect(() =>
    runTransforms([feature(0, 1)], [{ type: 'filter', expr: 'jexl:true' }]),
  ).toThrow(/jexl instance/)
})

test('an aggregate op over no field says so', () => {
  expect(() =>
    runTransforms(
      [feature(0, 1)],
      [{ type: 'aggregate', ops: [{ op: 'sum' }] }],
    ),
  ).toThrow(/needs a field/)
})

test('flatten answers one feature per subfeature, reading the parent for what it lacks', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'ctgA',
    start: 0,
    end: 100,
    name: 'BRCA1',
    strand: 1,
    subfeatures: [
      { uniqueId: 'e1', refName: 'ctgA', start: 0, end: 10, type: 'exon' },
      { uniqueId: 'e2', refName: 'ctgA', start: 40, end: 60, type: 'exon' },
    ],
  })
  const out = runTransforms([gene], [{ type: 'flatten' }])
  expect(rows(out, 'start', 'end', 'type', 'name', 'strand')).toEqual([
    [0, 10, 'exon', 'BRCA1', 1],
    [40, 60, 'exon', 'BRCA1', 1],
  ])
  expect(out.map(f => f.id())).toEqual(['e1', 'e2'])
  expect(out[0]!.parent!()!.id()).toBe('gene1')
  expect(out[1]!.toJSON()).toMatchObject({ name: 'BRCA1', start: 40, end: 60 })
})

test('flatten drops a feature with nothing in the field unless keepEmpty says otherwise', () => {
  const plain = feature(0, 10)
  expect(
    runTransforms([plain], [{ type: 'flatten', field: 'blocks' }]),
  ).toEqual([])
  expect(
    runTransforms(
      [plain],
      [{ type: 'flatten', field: 'blocks', keepEmpty: true }],
    ),
  ).toHaveLength(1)
})

test('flatten fans out plain records and index names the position', () => {
  const out = runTransforms(
    [
      feature(0, 100, {
        blocks: [
          { start: 5, end: 9 },
          { start: 20, end: 25 },
        ],
      }),
    ],
    [{ type: 'flatten', field: 'blocks', index: 'blockNumber' }],
  )
  expect(rows(out, 'start', 'end', 'blockNumber')).toEqual([
    [5, 9, 0],
    [20, 25, 1],
  ])
  expect(out.map(f => f.id())).toEqual(['0-100#0', '0-100#1'])
})

test('flatten twice reaches a gene’s exons, and a bin then counts them', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'ctgA',
    start: 0,
    end: 100,
    subfeatures: [
      {
        uniqueId: 't1',
        refName: 'ctgA',
        start: 0,
        end: 100,
        subfeatures: [
          { uniqueId: 'e1', refName: 'ctgA', start: 0, end: 5 },
          { uniqueId: 'e2', refName: 'ctgA', start: 6, end: 9 },
          { uniqueId: 'e3', refName: 'ctgA', start: 30, end: 35 },
        ],
      },
    ],
  })
  const out = runTransforms(
    [gene],
    [
      { type: 'flatten' },
      { type: 'flatten' },
      { type: 'bin', step: 10 },
      { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
    ],
  )
  expect(rows(out, 'start', 'end', 'count')).toEqual([
    [0, 10, 2],
    [30, 40, 1],
  ])
})

test('stack packs overlapping features onto the lowest free row, in start order', () => {
  const out = runTransforms(
    [
      feature(50, 90),
      feature(0, 20),
      feature(10, 30),
      feature(15, 25),
      feature(25, 40),
    ],
    [{ type: 'stack' }],
  )
  expect(rows(out, 'start', 'end', 'row')).toEqual([
    [0, 20, 0],
    [10, 30, 1],
    [15, 25, 2],
    [25, 40, 0],
    [50, 90, 0],
  ])
  expect(out[1]!.toJSON()).toMatchObject({ start: 10, end: 30, row: 1 })
})

test('stack padding keeps a row busy past the feature it holds', () => {
  const out = runTransforms(
    [feature(0, 20), feature(25, 40)],
    [{ type: 'stack', padding: 10 }],
  )
  expect(rows(out, 'start', 'row')).toEqual([
    [0, 0],
    [25, 1],
  ])
})

test('stack groups pack independently and each starts at row 0', () => {
  const out = runTransforms(
    [
      feature(0, 20, { sample: 'a' }),
      feature(5, 25, { sample: 'a' }),
      feature(0, 20, { sample: 'b' }),
      feature(5, 25, { sample: 'b' }),
    ],
    [{ type: 'stack', groupby: ['sample'] }],
  )
  expect(rows(out, 'sample', 'start', 'row')).toEqual([
    ['a', 0, 0],
    ['a', 5, 1],
    ['b', 0, 0],
    ['b', 5, 1],
  ])
})

test('stack reads the interval fields the step names and writes the field as names', () => {
  const out = runTransforms(
    [feature(0, 100, { s: 0, e: 20 }), feature(0, 100, { s: 30, e: 40 })],
    [{ type: 'stack', fields: ['s', 'e'], as: 'lane' }],
  )
  expect(rows(out, 's', 'lane')).toEqual([
    [0, 0],
    [30, 0],
  ])
})

// The claim ADR-118 rests on: `stack` is the same first-fit rule the display
// packers run, so what separates the transform stage from a pileup is the
// representation and the extra inputs, never the packing. `placeRect`'s
// clearance is 2, which is what the step spells as `padding`.
test('stack with placeRect padding assigns the rows placeRect does', () => {
  const spans: [number, number][] = []
  let seed = 1
  for (let i = 0; i < 500; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    const start = i * 3
    spans.push([start, start + 5 + (seed % 40)])
  }
  const rowsState: number[][] = []
  const expected = spans.map(([start, end]) => placeRect(rowsState, start, end))
  const out = runTransforms(
    spans.map(([start, end]) => feature(start, end)),
    [{ type: 'stack', padding: 2 }],
  )
  expect(out.map(f => f.get('row'))).toEqual(expected)
  expect(Math.max(...expected)).toBeGreaterThan(3)
})
