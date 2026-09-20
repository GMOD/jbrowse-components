import { FACET_ROW, facetLayers, runTransforms } from './featureTransforms.ts'
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

test('a mean is over the values that hold a number, a missing one counting as no zero', () => {
  const out = runTransforms(
    [
      feature(0, 5, { qual: 30 }),
      feature(5, 10, { qual: null }),
      feature(10, 15, { qual: '' }),
      feature(15, 20, { qual: [null] }),
    ],
    [{ type: 'aggregate', ops: [{ op: 'mean', field: 'qual' }] }],
  )
  expect(rows(out, 'mean_qual')).toEqual([[30]])
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

const STACK = [{ transform: [{ type: 'stack' as const }] }]

test('a facet packs each section on its own and stacks the sections', () => {
  const { layers, sections } = facetLayers(
    [
      feature(0, 20, { sample: 'b' }),
      feature(5, 25, { sample: 'b' }),
      feature(0, 20, { sample: 'a' }),
    ],
    'sample',
    STACK,
  )
  expect(sections).toEqual([
    { key: 'a', firstRow: 0, rowCount: 1 },
    { key: 'b', firstRow: 1, rowCount: 2 },
  ])
  expect(rows(layers[0]!, 'sample', 'start', FACET_ROW)).toEqual([
    ['a', 0, 0],
    ['b', 0, 1],
    ['b', 5, 2],
  ])
})

test('a faceted section is the unfaceted layer over its own features, offset', () => {
  const features = [
    feature(0, 20, { sample: 'a' }),
    feature(5, 25, { sample: 'b' }),
    feature(10, 30, { sample: 'a' }),
    feature(12, 14, { sample: 'b' }),
  ]
  const steps = [{ type: 'stack' as const }]
  const { layers, sections } = facetLayers(features, 'sample', [
    { transform: steps },
  ])
  for (const { key, firstRow } of sections) {
    const alone = runTransforms(
      features.filter(f => f.get('sample') === key),
      steps,
    )
    const faceted = layers[0]!.filter(f => f.get('sample') === key)
    expect(faceted.map(f => Number(f.get(FACET_ROW)) - firstRow)).toEqual(
      alone.map(f => f.get('row')),
    )
  }
})

test('a section is as tall as the tallest layer packed it, and a rowless layer sits on its first row', () => {
  const { layers, sections } = facetLayers(
    [feature(0, 20, { sample: 'a' }), feature(5, 25, { sample: 'a' })],
    'sample',
    [...STACK, {}],
  )
  expect(sections).toEqual([{ key: 'a', firstRow: 0, rowCount: 2 }])
  expect(layers[1]!.map(f => f.get(FACET_ROW))).toEqual([0, 0])
})

test('a facet orders digit keys by magnitude and files a missing value under its own section', () => {
  const { sections } = facetLayers(
    [feature(0, 10, { bin: 10 }), feature(0, 10, { bin: 2 }), feature(0, 10)],
    'bin',
    STACK,
  )
  expect(sections.map(s => s.key)).toEqual(['2', '10', ''])
})

test('a strand facet stacks forward, reverse, unstranded, and a missing strand is unstranded', () => {
  const { sections } = facetLayers(
    [
      feature(0, 10, { strand: 0 }),
      feature(0, 10, { strand: -1 }),
      feature(0, 10, { strand: 1 }),
      feature(0, 10),
    ],
    'strand',
    STACK,
  )
  expect(sections).toEqual([
    { key: '1', firstRow: 0, rowCount: 1 },
    { key: '-1', firstRow: 1, rowCount: 1 },
    { key: '0', firstRow: 2, rowCount: 2 },
  ])
})

test('a facet reads its field through a jexl expression', () => {
  const { sections } = facetLayers(
    [feature(0, 10, { tags: { HP: 1 } }), feature(0, 10, { tags: { HP: 2 } })],
    "jexl:get(feature,'tags').HP",
    STACK,
    createJexlInstance(),
  )
  expect(sections.map(s => s.key)).toEqual(['1', '2'])
})

test('a facet stacks a section of 200,000 features', () => {
  const features = Array.from({ length: 200_000 }, (_, i) => {
    const start = Math.floor(i / 4) * 100
    return feature(start, start + 50, { sample: 'a' })
  })
  const { layers, sections } = facetLayers(features, 'sample', STACK)
  expect(sections).toEqual([{ key: 'a', firstRow: 0, rowCount: 4 }])
  expect(layers[0]).toHaveLength(200_000)
})
