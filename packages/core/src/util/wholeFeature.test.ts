import { asTable } from './featureTable.ts'
import { layerTables, runTransforms } from './featureTransforms.ts'
import { NO_ROOT, encodeFeatures } from './markEncoding.ts'
import SimpleFeature from './simpleFeature.ts'
import { wholeFeatureRow } from './stepTables.ts'

import type { TransformStep } from './markEncodingTypes.ts'

const transcript = new SimpleFeature({
  uniqueId: 'tx1',
  refName: 'ctgA',
  start: 0,
  end: 100,
  sample: 'b',
  subfeatures: [
    { uniqueId: 'e1', refName: 'ctgA', start: 0, end: 10, type: 'exon' },
    { uniqueId: 'e2', refName: 'ctgA', start: 60, end: 100, type: 'exon' },
  ],
})
const solid = new SimpleFeature({
  uniqueId: 'solid',
  refName: 'ctgA',
  start: 20,
  end: 30,
  sample: 'a',
})
const block = new SimpleFeature({
  uniqueId: 'maf',
  refName: 'ctgA',
  start: 0,
  end: 50,
  alignments: { hg38: { seq: 'AC' }, panTro6: { seq: 'AG' } },
})

function roots(steps: TransformStep[][], facet?: { field: string }) {
  const root = asTable([transcript, solid])
  const { layers } = layerTables(
    root,
    { facet, layers: steps.map(transform => ({ transform })) },
    undefined,
  )
  return layers.map(({ table }) =>
    Array.from(encodeFeatures(table, {}, ['root'], { root }).root, o =>
      o === NO_ROOT ? 'none' : root.row(o).id(),
    ),
  )
}

test('a span and its flattened blocks name the same fetched feature, under a facet too', () => {
  const blocks: TransformStep[] = [{ type: 'flatten', keepEmpty: true }]
  expect(roots([[], blocks])).toEqual([
    ['tx1', 'solid'],
    ['tx1', 'tx1', 'solid'],
  ])
  expect(roots([[], blocks], { field: 'sample' })).toEqual([
    ['solid', 'tx1'],
    ['solid', 'tx1', 'tx1'],
  ])
})

test('a bin stands for a row of its own', () => {
  expect(
    roots([
      [
        { type: 'bin', step: 1000 },
        { type: 'aggregate', ops: [] },
      ],
    ]),
  ).toEqual([['none']])
})

test('a keyed record stands for a row of its own', () => {
  const root = asTable([block])
  const species = runTransforms(root, [
    { type: 'flatten', field: 'alignments', key: 'species' },
  ])
  expect(
    Array.from(encodeFeatures(species, {}, ['root'], { root }).root),
  ).toEqual([NO_ROOT, NO_ROOT])
  expect(wholeFeatureRow(species, 1).id()).toBe('maf#panTro6')
})

test('a block opens as the outermost feature it is part of', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'ctgA',
    start: 0,
    end: 100,
    subfeatures: [transcript.toJSON()],
  })
  const exons = runTransforms(
    [gene],
    [{ type: 'flatten' }, { type: 'flatten' }],
  )
  expect(wholeFeatureRow(exons, 1).id()).toBe('gene1')
  const blocks = runTransforms(
    [transcript, solid],
    [{ type: 'flatten', keepEmpty: true }],
  )
  expect(wholeFeatureRow(blocks, 1).toJSON().subfeatures).toHaveLength(2)
  expect(wholeFeatureRow(blocks, 2).id()).toBe('solid')
})
