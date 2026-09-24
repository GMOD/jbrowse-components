import { facetLayers, runTransforms } from './featureTransforms.ts'
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
  expect(rows(out, 'start', 'alt', 'svtype', 'mateDirection')).toEqual([
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

test('mate reads a symbolic allele off END and CHR2, and names its kind where INFO does not', () => {
  const out = runTransforms(
    [
      sv(100, ['<DEL>'], { END: [400] }),
      sv(500, ['<TRA>'], { END: [50], CHR2: ['ctgC'], SVTYPE: ['TRA'] }),
      sv(700, ['<DUP:TANDEM>'], { END: [900] }),
    ],
    [{ type: 'mate' }],
  )
  expect(rows(out, 'start', 'svtype', 'mateDirection')).toEqual([
    [100, 'DEL', 0],
    [500, 'TRA', 0],
    [700, 'DUP', 0],
  ])
  expect(out.map(f => f.get('mate'))).toEqual([
    { refName: 'ctgA', start: 399, end: 400, mateDirection: 0 },
    { refName: 'ctgC', start: 49, end: 50, mateDirection: 0 },
    { refName: 'ctgA', start: 899, end: 900, mateDirection: 0 },
  ])
  expect(out.map(f => f.id())).toEqual(['sv100', 'sv500', 'sv700'])
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
  expect(rows(out, 'mateDirection', 'score', 'alt', 'svtype')).toEqual([
    [-1, 7, undefined, undefined],
  ])
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
