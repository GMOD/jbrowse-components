import {
  facetLayers as facetTables,
  layerTables,
  matedBy,
  runTransforms as runTables,
} from './featureTransforms.ts'
import createJexlInstance from './jexl.ts'
import { placeRect } from './layouts/placeRect.ts'
import SimpleFeature from './simpleFeature.ts'

import type { FeatureTable } from './featureTable.ts'
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

// The steps answer tables; these read one back, row by row, as the feature
// list and plain row numbers the assertions below were written against.
function tableFeatures(table: FeatureTable) {
  return Array.from({ length: table.length }, (_, i) => table.row(i))
}
function runTransforms(...args: Parameters<typeof runTables>) {
  return tableFeatures(runTables(...args))
}

function facetLayers(...args: Parameters<typeof facetTables>) {
  const { layers, sections } = facetTables(...args)
  return {
    sections,
    layers: layers.map(({ table, rows: stacked }) => ({
      features: tableFeatures(table),
      rows: [...stacked],
    })),
  }
}

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

test('coverage keeps one run where one feature ends as another starts, or one adds no depth', () => {
  const out = runTransforms(
    [feature(0, 10), feature(10, 20), feature(15, 15), feature(0, 30)],
    [{ type: 'coverage' }],
  )
  expect(rows(out, 'start', 'end', 'coverage')).toEqual([
    [0, 20, 2],
    [20, 30, 1],
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

test('coverage counts the features whose span it can read as though the rest were absent', () => {
  const out = runTransforms(
    [feature(0, 20), feature(10, 30, { svEnd: 40 }), feature(5, 15)],
    [
      { type: 'formula', expr: "jexl:get(feature,'svEnd')", as: 'end' },
      { type: 'coverage' },
    ],
    jexl,
  )
  expect(rows(out, 'start', 'end', 'coverage')).toEqual([[10, 40, 1]])
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

test('flatten fans out a record keyed by name, and key names each entry', () => {
  const block = feature(100, 160, {
    seq: 'ACGT',
    alignments: {
      hg38: { chr: 'chr1', srcStart: 5, strand: 1, seq: 'ACGT' },
      panTro6: { chr: 'chr1', srcStart: 9, strand: -1, seq: 'AC-T' },
    },
    genotypes: { HG001: '0/1', HG002: '1/1' },
  })
  const species = runTransforms(
    [block],
    [{ type: 'flatten', field: 'alignments', key: 'species', index: 'i' }],
  )
  expect(
    rows(species, 'species', 'i', 'start', 'end', 'srcStart', 'strand', 'seq'),
  ).toEqual([
    ['hg38', 0, 100, 160, 5, 1, 'ACGT'],
    ['panTro6', 1, 100, 160, 9, -1, 'AC-T'],
  ])
  expect(species.map(f => f.id())).toEqual(['100-160#hg38', '100-160#panTro6'])
  expect(species[1]!.toJSON()).toEqual({
    uniqueId: '100-160#panTro6',
    refName: 'ctgA',
    start: 100,
    end: 160,
    seq: 'AC-T',
    genotypes: { HG001: '0/1', HG002: '1/1' },
    chr: 'chr1',
    srcStart: 9,
    strand: -1,
    species: 'panTro6',
    i: 1,
  })
  expect(
    rows(
      runTransforms(
        [block],
        [{ type: 'flatten', field: 'genotypes', key: 'sample' }],
      ),
      'sample',
      'genotypes',
      'start',
    ),
  ).toEqual([
    ['HG001', '0/1', 100],
    ['HG002', '1/1', 100],
  ])
  expect(
    runTransforms(
      [feature(0, 10, { alignments: {} }), feature(0, 10, { alignments: 3 })],
      [{ type: 'flatten', field: 'alignments', key: 'species' }],
    ),
  ).toEqual([])
})

test('cells answers each row’s runs against the block it was fanned out of', () => {
  const block = feature(100, 108, {
    seq: 'ACG-TACGT',
    alignments: {
      ref: { seq: 'ACG-TACGT' },
      near: { seq: 'AcGGT-CTT' },
      cut: { seq: '--GGTACG-' },
      blank: { seq: '---------' },
    },
  })
  const out = runTransforms(
    [block],
    [
      { type: 'flatten', field: 'alignments', key: 'species' },
      { type: 'cells' },
    ],
  )
  expect(
    rows(out, 'species', 'start', 'end', 'state', 'base', 'match', 'length'),
  ).toEqual([
    ['ref', 100, 108, 'match', undefined, 1, undefined],
    ['near', 103, 103, 'insertion', 'G', undefined, 1],
    ['near', 100, 104, 'match', undefined, 1, undefined],
    ['near', 104, 105, 'gap', undefined, undefined, undefined],
    ['near', 105, 106, 'match', undefined, 1, undefined],
    ['near', 106, 107, 'mismatch', 'T', 0, undefined],
    ['near', 107, 108, 'match', undefined, 1, undefined],
    ['cut', 103, 103, 'insertion', 'G', undefined, 1],
    ['cut', 102, 107, 'match', undefined, 1, undefined],
  ])
  expect(out[1]!.id()).toBe('100-108#near#0')
  expect(out[1]!.get('refName')).toBe('ctgA')
  expect(
    runTransforms([feature(0, 4, { seq: 'ACGT' })], [{ type: 'cells' }]),
  ).toEqual([])
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

test('pileup packs overlapping features onto the lowest free row, in start order', () => {
  const out = runTransforms(
    [
      feature(50, 90),
      feature(0, 20),
      feature(10, 30),
      feature(15, 25),
      feature(25, 40),
    ],
    [{ type: 'pileup' }],
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

test('pileup padding keeps a row busy past the feature it holds', () => {
  const out = runTransforms(
    [feature(0, 20), feature(25, 40)],
    [{ type: 'pileup', padding: 10 }],
  )
  expect(rows(out, 'start', 'row')).toEqual([
    [0, 0],
    [25, 1],
  ])
})

test('pileup reads the interval fields the step names and writes the field as names', () => {
  const out = runTransforms(
    [feature(0, 100, { s: 0, e: 20 }), feature(0, 100, { s: 30, e: 40 })],
    [{ type: 'pileup', fields: ['s', 'e'], as: 'lane' }],
  )
  expect(rows(out, 's', 'lane')).toEqual([
    [0, 0],
    [30, 0],
  ])
})

// The claim ADR-118 rests on: `pileup` is the same first-fit rule the display
// packers run, so what separates the transform stage from the alignments
// packer is the representation and the extra inputs, never the packing.
// `placeRect`'s clearance is 2, which is what the step spells as `padding`.
test('pileup with placeRect padding assigns the rows placeRect does', () => {
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
    [{ type: 'pileup', padding: 2 }],
  )
  expect(out.map(f => f.get('row'))).toEqual(expected)
  expect(Math.max(...expected)).toBeGreaterThan(3)
})

const PILEUP = [{ transform: [{ type: 'pileup' as const }], row: 'row' }]

test('a facet packs each section on its own and stacks the sections', () => {
  const { layers, sections } = facetLayers(
    [
      feature(0, 20, { sample: 'b' }),
      feature(5, 25, { sample: 'b' }),
      feature(0, 20, { sample: 'a' }),
    ],
    { field: 'sample' },
    PILEUP,
  )
  expect(sections).toEqual([
    { key: 'a', firstRow: 0, rowCount: 1 },
    { key: 'b', firstRow: 1, rowCount: 2 },
  ])
  const { features, rows: stacked } = layers[0]!
  expect(rows(features, 'sample', 'start')).toEqual([
    ['a', 0],
    ['b', 0],
    ['b', 5],
  ])
  expect(stacked).toEqual([0, 1, 2])
})

test('a faceted section is the unfaceted layer over its own features, offset', () => {
  const features = [
    feature(0, 20, { sample: 'a' }),
    feature(5, 25, { sample: 'b' }),
    feature(10, 30, { sample: 'a' }),
    feature(12, 14, { sample: 'b' }),
  ]
  const steps = [{ type: 'pileup' as const }]
  const { layers, sections } = facetLayers(features, { field: 'sample' }, [
    { transform: steps, row: 'row' },
  ])
  for (const { key, firstRow } of sections) {
    const alone = runTransforms(
      features.filter(f => f.get('sample') === key),
      steps,
    )
    const { features: placed, rows: stacked } = layers[0]!
    const inSection = placed.flatMap((f, i) =>
      f.get('sample') === key ? [stacked[i]! - firstRow] : [],
    )
    expect(inSection).toEqual(alone.map(f => f.get('row')))
  }
})

test("a section's coverage runs and aggregate groups still name the facet's value", () => {
  const features = [
    feature(0, 20, { sample: 'b', strand: -1 }),
    feature(5, 25, { sample: 'b', strand: -1 }),
    feature(0, 20, { sample: 'a', strand: 1 }),
    feature(30, 40, { strand: 1 }),
  ]
  const { layers } = facetLayers(features, { field: 'sample' }, [
    { transform: [{ type: 'coverage' }] },
    {
      transform: [
        { type: 'bin', step: 100 },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
    },
    {
      transform: [
        {
          type: 'aggregate',
          groupby: ['sample'],
          ops: [{ op: 'count' }],
        },
      ],
    },
  ])
  const [runs, bins, groups] = layers
  expect(rows(runs!.features, 'sample', 'coverage')).toEqual([
    ['a', 1],
    ['b', 1],
    ['b', 2],
    ['b', 1],
    [undefined, 1],
  ])
  expect(runs!.features[0]!.toJSON()).toMatchObject({ sample: 'a' })
  expect(runs!.features[4]!.toJSON()).not.toHaveProperty('sample')
  expect(rows(bins!.features, 'sample', 'count')).toEqual([
    ['a', 1],
    ['b', 2],
    [undefined, 1],
  ])
  expect(rows(groups!.features, 'sample', 'count')).toEqual([
    ['a', 1],
    ['b', 2],
    [undefined, 1],
  ])
})

test("a facet on a dotted path names it on the section's made rows", () => {
  const { layers } = facetLayers(
    [feature(0, 20, { tags: { HP: 2 } }), feature(0, 20, { tags: { HP: 1 } })],
    { field: 'tags.HP' },
    [{ transform: [{ type: 'coverage' }] }],
  )
  expect(rows(layers[0]!.features, 'tags.HP', 'coverage')).toEqual([
    ['1', 1],
    ['2', 1],
  ])
})

test('coverage by a field cuts every group at the same stretches, and a stack stands them on each other', () => {
  const reads = [
    feature(0, 10, { strand: 1 }),
    feature(5, 15, { strand: -1 }),
    feature(5, 20, { strand: 1 }),
  ]
  const runs = runTransforms(reads, [{ type: 'coverage', groupby: ['strand'] }])
  expect(rows(runs, 'start', 'end', 'strand', 'coverage')).toEqual([
    [0, 5, 1, 1],
    [5, 10, 1, 2],
    [5, 10, -1, 1],
    [10, 15, 1, 1],
    [10, 15, -1, 1],
    [15, 20, 1, 1],
  ])
  const stacked = runTransforms(reads, [
    { type: 'coverage', groupby: ['strand'] },
    { type: 'stack', field: 'coverage', by: 'strand' },
  ])
  expect(rows(stacked, 'start', 'strand', 'y0', 'y1')).toEqual([
    [0, 1, 0, 1],
    [5, 1, 0, 2],
    [5, -1, 2, 3],
    [10, 1, 0, 1],
    [10, -1, 1, 2],
    [15, 1, 0, 1],
  ])
  expect(stacked[2]!.toJSON()).toMatchObject({ y0: 2, y1: 3, strand: -1 })
})

test('a stack follows the order its by field takes, and a value that is no number adds nothing', () => {
  const out = runTransforms(
    [
      feature(0, 10, { kind: 'b', count: 2 }),
      feature(0, 10, { kind: 'a', count: 'x' }),
      feature(0, 10, { kind: 'a', count: 3 }),
      feature(10, 20, { kind: 'b', count: 4 }),
    ],
    [{ type: 'stack', by: 'kind', as: ['lo', 'hi'] }],
  )
  expect(rows(out, 'kind', 'lo', 'hi')).toEqual([
    ['b', 3, 5],
    ['a', 0, 0],
    ['a', 0, 3],
    ['b', 0, 4],
  ])
})

// The encoder reads each feature's own fields, and the row beside it.
test('a faceted layer hands on its features as its steps left them', () => {
  const features = [
    feature(0, 20, { sample: 'b' }),
    feature(0, 20, { sample: 'a' }),
  ]
  const { layers } = facetLayers(features, { field: 'sample' }, [{}])
  const [first, second] = layers[0]!.features
  expect(first).toBe(features[1])
  expect(second).toBe(features[0])
})

// The rowless layer's features carry a `row` field a display-level pileup
// could have written: a layer naming no row field reads none, as the unfaceted
// encoder reads none, rather than that field under its default name.
test("a facet's own steps run over each section before every layer's, shared by all", () => {
  const { layers, sections } = facetLayers(
    [
      feature(0, 20, { sample: 'a' }),
      feature(5, 25, { sample: 'b' }),
      feature(10, 30, { sample: 'a' }),
    ],
    { field: 'sample', transform: [{ type: 'pileup' }] },
    [{}, { row: 'row' }],
  )
  expect(sections).toEqual([
    { key: 'a', firstRow: 0, rowCount: 2 },
    { key: 'b', firstRow: 2, rowCount: 1 },
  ])
  expect(layers[0]!.rows).toEqual([0, 0, 2])
  expect(layers[1]!.rows).toEqual([0, 1, 2])
})

test('a section is as tall as the tallest layer packed it, and a rowless layer sits on its first row', () => {
  const { layers, sections } = facetLayers(
    [
      feature(0, 20, { sample: 'a', row: 3 }),
      feature(5, 25, { sample: 'a', row: 3 }),
    ],
    { field: 'sample' },
    [...PILEUP, {}],
  )
  expect(sections).toEqual([{ key: 'a', firstRow: 0, rowCount: 2 }])
  expect(layers[1]!.rows).toEqual([0, 0])
})

test('a facet orders digit keys by magnitude and files a missing value under its own section', () => {
  const { sections } = facetLayers(
    [feature(0, 10, { bin: 10 }), feature(0, 10, { bin: 2 }), feature(0, 10)],
    { field: 'bin' },
    PILEUP,
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
    { field: 'strand' },
    PILEUP,
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
    { field: "jexl:get(feature,'tags').HP" },
    PILEUP,
    createJexlInstance(),
  )
  expect(sections.map(s => s.key)).toEqual(['1', '2'])
})

test('a facet stacks a section of 200,000 features', () => {
  const features = Array.from({ length: 200_000 }, (_, i) => {
    const start = Math.floor(i / 4) * 100
    return feature(start, start + 50, { sample: 'a' })
  })
  const { layers, sections } = facetLayers(
    features,
    { field: 'sample' },
    PILEUP,
  )
  expect(sections).toEqual([{ key: 'a', firstRow: 0, rowCount: 4 }])
  expect(layers[0]!.features).toHaveLength(200_000)
  expect(layers[0]!.rows).toHaveLength(200_000)
})

function variant(start: number, dp: number, svtype: string, svend: number) {
  return feature(start, start + 1, {
    ALT: [`<${svtype}>`],
    svend,
    INFO: { DP: [dp], SVTYPE: [svtype], END: [svend] },
  })
}

const VARIANTS = [
  variant(100, 10, 'DEL', 900),
  variant(200, 20, 'DEL', 400),
  variant(300, 30, 'DUP', 1200),
]

// A step read `f.get(name)` where a channel and the facet read a dotted path,
// so a VCF's INFO fields reached an encoding and no step.
test('an aggregate op reads a dotted path, and its output reads back as the channel it names', () => {
  const out = runTransforms(VARIANTS, [
    { type: 'aggregate', ops: [{ op: 'mean', field: 'INFO.DP' }] },
  ])
  expect(rows(out, 'mean_INFO.DP')).toEqual([[20]])
})

test('a dotted groupby groups by the value a one-element list holds, and hands that value on', () => {
  const out = runTransforms(VARIANTS, [
    {
      type: 'aggregate',
      groupby: ['INFO.SVTYPE'],
      ops: [{ op: 'count' }, { op: 'max', field: 'INFO.DP' }],
    },
  ])
  expect(rows(out, 'INFO.SVTYPE', 'count', 'max_INFO.DP')).toEqual([
    ['DEL', 2, 20],
    ['DUP', 1, 30],
  ])
})

test('a plain groupby over a field holding one-element lists groups by the element', () => {
  const out = runTransforms(VARIANTS, [
    { type: 'aggregate', groupby: ['ALT'], ops: [{ op: 'count' }] },
  ])
  expect(rows(out, 'ALT', 'count')).toEqual([
    ['<DEL>', 2],
    ['<DUP>', 1],
  ])
})

test('a plain groupby keys by the element where the first feature lacks the field', () => {
  const out = runTransforms(
    [
      feature(100, 101, {}),
      feature(200, 201, { ALT: ['<DEL>'] }),
      feature(300, 301, { ALT: ['<DEL>'] }),
      feature(400, 401, { ALT: ['<DUP>'] }),
    ],
    [{ type: 'aggregate', groupby: ['ALT'], ops: [{ op: 'count' }] }],
  )
  expect(rows(out, 'ALT', 'count')).toEqual([
    [undefined, 1],
    ['<DEL>', 2],
    ['<DUP>', 1],
  ])
})

test('a VCF missing value and an absent field are one group', () => {
  const out = runTransforms(
    [
      feature(100, 101, { ALT: ['<DEL>'] }),
      feature(200, 201, { ALT: [null] }),
      feature(300, 301, {}),
    ],
    [{ type: 'aggregate', groupby: ['ALT'], ops: [{ op: 'count' }] }],
  )
  expect(rows(out, 'ALT', 'count')).toEqual([
    ['<DEL>', 1],
    [undefined, 2],
  ])
})

test('a plain groupby keys by the element where the first feature holds a plain string', () => {
  const out = runTransforms(
    [
      feature(100, 101, { ALT: '<DEL>' }),
      feature(200, 201, { ALT: ['<DEL>'] }),
      feature(300, 301, { ALT: ['<DUP>'] }),
      feature(400, 401, { ALT: ['<DUP>'] }),
    ],
    [{ type: 'aggregate', groupby: ['ALT'], ops: [{ op: 'count' }] }],
  )
  expect(rows(out, 'ALT', 'count')).toEqual([
    ['<DEL>', 2],
    ['<DUP>', 2],
  ])
})

test('bin and pileup read a dotted path as they read the same values under a plain name', () => {
  const edges = (field: string) =>
    rows(
      runTransforms(VARIANTS, [{ type: 'bin', step: 500, field }]),
      'start',
      'end',
    )
  expect(edges('INFO.END')).toEqual(edges('svend'))
  expect(edges('INFO.END')).toEqual([
    [500, 1000],
    [0, 500],
    [1000, 1500],
  ])
  const packed = (end: string) =>
    rows(
      runTransforms(VARIANTS, [{ type: 'pileup', fields: ['start', end] }]),
      'row',
    )
  expect(packed('INFO.END')).toEqual(packed('svend'))
  expect(packed('INFO.END')).toEqual([[0], [1], [2]])
})

test('a field whose own name holds a dot is read whole, so a config naming one means what it did', () => {
  const dotted = [
    feature(0, 10, { 'a.b': 3, kind: 'x' }),
    feature(20, 30, { 'a.b': 5, kind: 'x' }),
  ]
  const plain = [
    feature(0, 10, { ab: 3, kind: 'x' }),
    feature(20, 30, { ab: 5, kind: 'x' }),
  ]
  const summed = (features: Feature[], field: string) =>
    rows(
      runTransforms(features, [
        {
          type: 'aggregate',
          groupby: ['kind'],
          ops: [{ op: 'sum', field, as: 'sum' }],
        },
      ]),
      'kind',
      'sum',
    )
  expect(summed(dotted, 'a.b')).toEqual(summed(plain, 'ab'))
  expect(summed(dotted, 'a.b')).toEqual([['x', 8]])
})

test('a jexl: field on a step names the step and points at formula', () => {
  expect(() =>
    runTransforms(
      VARIANTS,
      [
        {
          type: 'aggregate',
          ops: [{ op: 'mean', field: 'jexl:feature.score' }],
        },
      ],
      jexl,
    ),
  ).toThrow(/an aggregate field is a name or a dotted path.*formula/)
  expect(() =>
    runTransforms(VARIANTS, [{ type: 'bin', step: 10, field: 'jexl:1' }], jexl),
  ).toThrow(/a bin field is a name or a dotted path.*formula/)
})

test('a pileup packs the features whose start it can read as though the rest were absent', () => {
  const at = (start: number | undefined, id: string) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'ctgA',
      start: start ?? 0,
      end: 100,
      INFO: start === undefined ? {} : { POS: start },
    })
  const out = runTransforms(
    [at(10, 'a'), at(undefined, 'x'), at(20, 'b')],
    [{ type: 'pileup', fields: ['INFO.POS', 'end'] }],
  )
  const rowOf = Object.fromEntries(out.map(f => [f.id(), f.get('row')]))
  expect([rowOf.a, rowOf.b]).toEqual([0, 1])
  expect(out.map(f => f.id())).toEqual(['a', 'b', 'x'])
})

// The packing as it was written before it read each interval once: a stable
// sort through a comparator, then first fit. Ties keep the order they arrived
// in, and an unsorted list is what a transform in front of a pileup hands it.
function comparatorPileup(features: readonly Feature[], padding: number) {
  const sorted = [...features].sort((a, b) => a.get('start') - b.get('start'))
  const rowEnds: number[] = []
  return sorted.map(f => {
    const start: number = f.get('start')
    const end: number = f.get('end')
    let row = 0
    while (row < rowEnds.length && rowEnds[row]! > start) {
      row++
    }
    rowEnds[row] = (end > start ? end : start) + padding
    return [f.id(), row]
  })
}

test('a pileup over shuffled input with tied starts packs as the comparator sort did', () => {
  let seed = 7
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648)
  const shuffled = Array.from({ length: 2000 }, (_, i) => {
    const start = (next() % 300) * 10
    return new SimpleFeature({
      uniqueId: `f${i}`,
      refName: 'ctgA',
      start,
      end: start + 10 + (next() % 200),
    })
  })
  for (const padding of [0, 5]) {
    const out = runTransforms(shuffled, [{ type: 'pileup', padding }])
    expect(out.map(f => [f.id(), f.get('row')])).toEqual(
      comparatorPileup(shuffled, padding),
    )
  }
})

function sv(
  start: number,
  alts: string[],
  info: Record<string, unknown[]> = {},
  id = `sv${start}`,
) {
  return new SimpleFeature({
    uniqueId: id,
    refName: 'ctgA',
    start,
    end: start + 1,
    ALT: alts,
    INFO: info,
  })
}

test('mate answers one feature per breakend ALT, with the mate locus 0-based and both directions', () => {
  const out = runTransforms(
    [sv(999, ['N[ctgB:2000[', ']ctgA:5000]N'], { SVTYPE: ['BND'] })],
    [{ type: 'mate' }],
  )
  expect(out.map(f => f.id())).toEqual(['sv999#0', 'sv999#1'])
  expect(rows(out, 'start', 'alt', 'svType', 'mateDirection')).toEqual([
    [999, 'N[ctgB:2000[', 'BND', -1],
    [999, ']ctgA:5000]N', 'BND', 1],
  ])
  expect(out[0]!.get('mate')).toEqual({
    refName: 'ctgB',
    start: 1999,
    end: 2000,
    mateDirection: 1,
  })
  expect(out[1]!.get('mate')).toEqual({
    refName: 'ctgA',
    start: 4999,
    end: 5000,
    mateDirection: -1,
  })
  expect(out[0]!.toJSON()).toMatchObject({ alt: 'N[ctgB:2000[', start: 999 })
})

// The directions are `junctionEnds`', the split view's and the launchers':
// a deletion keeps the sequence outside it, a tandem duplication the sequence
// inside, and a translocation says nothing without STRANDS.
test('mate reads a symbolic allele off END and CHR2, and names its kind where INFO does not', () => {
  const out = runTransforms(
    [
      sv(100, ['<DEL>'], { END: [400] }),
      sv(500, ['<TRA>'], { END: [50], CHR2: ['ctgC'], SVTYPE: ['TRA'] }),
      sv(700, ['<DUP:TANDEM>'], { END: [900] }),
    ],
    [{ type: 'mate' }],
  )
  expect(rows(out, 'start', 'svType', 'mateDirection')).toEqual([
    [100, 'DEL', -1],
    [500, 'BND', 0],
    [700, 'DUP', 1],
  ])
  expect(out.map(f => f.get('mate'))).toEqual([
    { refName: 'ctgA', start: 399, end: 400, mateDirection: 1 },
    { refName: 'ctgC', start: 49, end: 50, mateDirection: 0 },
    { refName: 'ctgA', start: 899, end: 900, mateDirection: -1 },
  ])
  expect(out.map(f => f.id())).toEqual(['sv100', 'sv500', 'sv700'])
})

test('mate answers a read pair once, from the read met first, where the file places its next segment', () => {
  const read = (
    id: string,
    start: number,
    mate: [string, number] | undefined,
  ) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'ctgA',
      start,
      end: start + 100,
      flags: mate ? 1 : 0,
      ...(mate ? { next_ref: mate[0], next_pos: mate[1] } : {}),
    })
  const out = runTransforms(
    [
      read('a1', 100, ['ctgA', 400]),
      read('lone', 150, undefined),
      read('a2', 400, ['ctgA', 100]),
      read('b1', 500, ['ctgB', 50]),
    ],
    [{ type: 'mate' }],
  )
  expect(out.map(f => f.id())).toEqual(['a1', 'b1'])
  expect(out.map(f => f.get('mate'))).toEqual([
    { refName: 'ctgA', start: 400, end: 401, mateDirection: 0 },
    { refName: 'ctgB', start: 50, end: 51, mateDirection: 0 },
  ])
  expect(rows(out, 'start', 'flags', 'svType')).toEqual([
    [100, 1, undefined],
    [500, 1, undefined],
  ])
})

// a breakend's ALT says only that it is one; the class the record declares
// is the event, and each allele of a record keeps its own
test('mate names each link the class its allele states', () => {
  const out = runTransforms(
    [
      sv(100, ['N[ctgA:500['], { SVTYPE: ['DEL'] }),
      sv(700, ['<DEL>', '<DUP>'], { SVLEN: [100, 200] }),
    ],
    [{ type: 'mate' }],
  )
  expect(rows(out, 'start', 'svType')).toEqual([
    [100, 'DEL'],
    [700, 'DEL'],
    [700, 'DUP'],
  ])
})

test('mate passes a paired record through on its own mate, and drops a record naming no other end', () => {
  const bedpe = feature(10, 20, {
    mate: { refName: 'ctgB', start: 30, end: 40 },
    mateDirection: -1,
    score: 7,
  })
  const out = runTransforms(
    [bedpe, sv(50, ['A']), feature(60, 70)],
    [{ type: 'mate' }],
  )
  expect(out).toHaveLength(1)
  expect(out[0]!.get('mate')).toEqual({
    refName: 'ctgB',
    start: 30,
    end: 40,
    mateDirection: 0,
  })
  expect(rows(out, 'mateDirection', 'score', 'alt', 'svType')).toEqual([
    [-1, 7, undefined, undefined],
  ])
})

test('mate keeps two pairs that share only their starts', () => {
  const out = runTransforms(
    [
      feature(1000, 1500, {
        mate: { refName: 'ctgA', start: 50000, end: 51000 },
        score: 3,
      }),
      feature(1000, 2000, {
        mate: { refName: 'ctgA', start: 50000, end: 52000 },
        score: 90,
      }),
    ],
    [{ type: 'mate' }],
  )
  expect(rows(out, 'score')).toEqual([[3], [90]])
})

// A BEDPE row states no direction, and its strand names the side of the block
// the junction is on.
test("mate reads a paired row's directions off its strands where none is stated", () => {
  const out = runTransforms(
    [
      feature(10, 20, {
        strand: 1,
        mate: { refName: 'ctgB', start: 30, end: 40, strand: -1 },
      }),
    ],
    [{ type: 'mate' }],
  )
  expect(rows(out, 'mateDirection')).toEqual([[-1]])
  expect(out[0]!.get('mate')).toMatchObject({ mateDirection: 1 })
})

test('mate answers a pair of ends once, whichever record or allele states it', () => {
  const out = runTransforms(
    [
      sv(999, ['N[ctgA:5000['], {}, 'a'),
      sv(4999, [']ctgA:1000]N'], {}, 'b'),
      feature(10, 11, { mate: { refName: 'ctgB', start: 30, end: 31 } }),
      new SimpleFeature({
        uniqueId: 'flipped',
        refName: 'ctgB',
        start: 30,
        end: 31,
        mate: { refName: 'ctgA', start: 10, end: 11 },
      }),
    ],
    [{ type: 'mate' }],
  )
  expect(out.map(f => f.id())).toEqual(['a', '10-11'])
})

// The default plot decides on `matedBy` whether links are the picture a track
// wants, and the mate step decides again on its own reading. They have to
// agree: a record the default draws links for and the step then drops leaves
// an empty display, and one the step would pair draws nothing at all.
test('matedBy names a second end for exactly the records the mate step keeps', () => {
  const records = [
    sv(999, ['N[ctgB:2000['], { SVTYPE: ['BND'] }, 'bnd'),
    sv(100, ['<DEL>'], { END: [400] }, 'del'),
    sv(200, ['<DEL>'], {}, 'del-no-end'),
    sv(300, ['A'], {}, 'snv'),
    sv(400, ['A', 'N]ctgB:900]'], {}, 'snv-then-bnd'),
    feature(10, 20, { mate: { refName: 'ctgB', start: 30, end: 40 } }),
    feature(60, 70),
  ]
  const kept = new Set(
    runTransforms(records, [{ type: 'mate' }]).map(f =>
      f.id().replace(/#\d+$/, ''),
    ),
  )
  expect(records.map(f => [f.id(), matedBy(f) !== undefined])).toEqual(
    records.map(f => [f.id(), kept.has(f.id())]),
  )
  expect(matedBy(records[0]!)).toBe('alt')
  expect(matedBy(records[5]!)).toBe('mate')
})

test('flatten over records stating no span, or over plain values, stands each in the container', () => {
  const vcf = new SimpleFeature({
    uniqueId: 'v',
    refName: 'ctgA',
    start: 99,
    end: 100,
    ALT: ['C', 'G'],
    tags: [{ key: 'a' }, { key: 'b' }],
  })
  expect(
    rows(
      runTransforms([vcf], [{ type: 'flatten', field: 'tags' }]),
      'key',
      'start',
      'end',
    ),
  ).toEqual([
    ['a', 99, 100],
    ['b', 99, 100],
  ])
  const alts = runTransforms(
    [vcf],
    [{ type: 'flatten', field: 'ALT', index: 'i' }],
  )
  expect(rows(alts, 'ALT', 'i', 'start')).toEqual([
    ['C', 0, 99],
    ['G', 1, 99],
  ])
  expect(alts.map(f => f.id())).toEqual(['v#0', 'v#1'])
})

test('a flattened leaf holding nothing in the field answers none, never its siblings', () => {
  const gene = new SimpleFeature({
    uniqueId: 'g',
    refName: 'ctgA',
    start: 0,
    end: 1000,
    name: 'G1',
    subfeatures: [
      {
        uniqueId: 'mrna',
        refName: 'ctgA',
        start: 0,
        end: 1000,
        type: 'mRNA',
        subfeatures: [
          { uniqueId: 'e1', refName: 'ctgA', start: 0, end: 100, type: 'exon' },
          {
            uniqueId: 'e2',
            refName: 'ctgA',
            start: 900,
            end: 1000,
            type: 'exon',
          },
        ],
      },
      { uniqueId: 'nc', refName: 'ctgA', start: 200, end: 300, type: 'ncRNA' },
    ],
  })
  const twice = runTransforms(
    [gene],
    [{ type: 'flatten' }, { type: 'flatten' }],
  )
  expect(twice.map(f => f.id())).toEqual(['e1', 'e2'])
  const kept = runTransforms(
    [gene],
    [{ type: 'flatten' }, { type: 'flatten', keepEmpty: true }],
  )
  expect(kept.map(f => f.id())).toEqual(['e1', 'e2', 'nc'])
  expect(kept[2]!.get('name')).toBe('G1')
})

// A container a flatten kept with nothing to fan out is the row itself: its
// reference is its own container's, so a block reads against nothing rather
// than against its own sequence.
test('cells over a kept container reads no reference of its own', () => {
  const lone = feature(0, 4, { seq: 'ACGT' })
  const kept = runTables(
    [lone],
    [{ type: 'flatten', field: 'alignments', keepEmpty: true }],
  )
  expect(kept.row(0)).toBe(lone)
  expect(tableFeatures(runTables(kept, [{ type: 'cells' }]))).toEqual([])
})

test('a facet on a flatten key splits the runs a cells step made, per species', () => {
  const block = feature(100, 104, {
    seq: 'ACGT',
    alignments: { b: { seq: 'ACGA' }, a: { seq: 'ACGT' } },
  })
  const shared = runTables(
    [block],
    [
      { type: 'flatten', field: 'alignments', key: 'species' },
      { type: 'cells' },
    ],
  )
  expect(shared.column('species').kind).toBe('category')
  const { layers, sections } = facetLayers(shared, { field: 'species' }, [{}])
  expect(sections.map(s => s.key)).toEqual(['a', 'b'])
  expect(rows(layers[0]!.features, 'species', 'start', 'end', 'state')).toEqual(
    [
      ['a', 100, 104, 'match'],
      ['b', 100, 103, 'match'],
      ['b', 103, 104, 'mismatch'],
    ],
  )
  expect(layers[0]!.rows).toEqual([0, 1, 1])
})

// The split comes after the last shared step that must see every row, so a
// cells step behind the flatten runs over rows already in section order.
test('a request split before its row-by-row steps answers what splitting after them does', () => {
  const block = (start: number, rowsBySpecies: Record<string, string>) =>
    feature(start, start + 4, {
      seq: 'ACGT',
      alignments: Object.fromEntries(
        Object.entries(rowsBySpecies).map(([k, seq]) => [k, { seq }]),
      ),
    })
  const blocks = [
    block(0, { b: 'ACGA', a: 'AC-T' }),
    block(10, { a: 'ACGT', b: 'TCGT' }),
  ]
  const transform = [
    { type: 'flatten' as const, field: 'alignments', key: 'species' },
    { type: 'cells' as const },
    { type: 'filter' as const, expr: "jexl:get(feature,'state') != 'gap'" },
  ]
  const facet = { field: 'species' }
  const layers = [{}, { transform: [{ type: 'pileup' as const }], row: 'row' }]
  const early = layerTables(blocks, { transform, facet, layers }, jexl)
  const late = facetTables(
    runTables(blocks, transform, jexl),
    facet,
    layers,
    jexl,
  )
  expect(early.sections).toEqual(late.sections)
  for (const [i, layer] of early.layers.entries()) {
    const fields = ['species', 'start', 'end', 'state']
    expect(rows(tableFeatures(layer.table), ...fields)).toEqual(
      rows(tableFeatures(late.layers[i]!.table), ...fields),
    )
    expect([...(layer.row as Uint32Array)]).toEqual([...late.layers[i]!.rows])
  }
})
