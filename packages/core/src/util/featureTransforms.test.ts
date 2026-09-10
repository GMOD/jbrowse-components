import { runTransforms } from './featureTransforms.ts'
import createJexlInstance from './jexl.ts'
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
  expect(out[0]!.parent()!.id()).toBe('gene1')
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
