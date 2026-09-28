import { layerTables } from '@jbrowse/core/util/featureTransforms'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import { from } from 'rxjs'

import MafFeature from '../MafFeature.ts'
import { mafFeatureTable } from './mafFeatureTable.ts'

import type { FeatureTable } from '@jbrowse/core/util/featureTable'

const blocks = [
  new MafFeature(
    'block0',
    100,
    108,
    'chr1',
    0,
    {
      hg38: {
        chr: 'chr1',
        srcStart: 100,
        strand: 1,
        srcSize: 5000,
        seq: 'ACGT--ACGT',
      },
      panTro6: {
        chr: 'chr3',
        srcStart: 40,
        strand: -1,
        srcSize: 900,
        seq: 'ACTTGGA-GT',
        context: {
          leftStatus: 'C',
          leftCount: 0,
          rightStatus: 'I',
          rightCount: 12,
        },
      },
      mm10: { chr: 'chr9', srcStart: 7, strand: 1, seq: '--GTAAACGA' },
    },
    'ACGT--ACGT',
  ),
  new MafFeature(
    'block1',
    108,
    112,
    'chr1',
    0,
    {
      hg38: {
        chr: 'chr1',
        srcStart: 108,
        strand: 1,
        srcSize: 5000,
        seq: 'TTAG',
      },
      mm10: { chr: 'chr9', srcStart: 15, strand: 1, srcSize: 60, seq: 'TCAG' },
    },
    'TTAG',
    {
      panTro6: {
        chr: 'chr3',
        srcStart: 48,
        size: 30,
        strand: -1,
        srcSize: 900,
        status: 'I',
      },
    },
  ),
]

const SPECIES_CELLS = {
  transform: [
    { type: 'flatten' as const, field: 'alignments', key: 'species' },
    { type: 'cells' as const },
  ],
  facet: { field: 'species' },
  layers: [{}],
}

function rowsOf(table: FeatureTable) {
  return Array.from({ length: table.length }, (_, i) => {
    const row = table.row(i)
    return {
      id: row.id(),
      json: row.toJSON(),
      fields: ['start', 'end', 'species', 'state', 'base', 'chr', 'strand'].map(
        f => row.get(f),
      ),
    }
  })
}

test('a block row answers the fields and JSON its MafFeature does', async () => {
  const table = await mafFeatureTable(from(blocks), 'chr1')
  expect(table.length).toBe(2)
  for (const [i, block] of blocks.entries()) {
    expect(table.row(i).id()).toBe(block.id())
    expect(table.row(i).toJSON()).toEqual(block.toJSON())
  }
})

test('species cells over the packed table answer what they do over MafFeatures', async () => {
  const table = await mafFeatureTable(from(blocks), 'chr1')
  const packed = layerTables(table, SPECIES_CELLS).layers[0]!
  const features = layerTables(blocks, SPECIES_CELLS).layers[0]!
  expect(packed.table.length).toBeGreaterThan(0)
  expect(rowsOf(packed.table)).toEqual(rowsOf(features.table))
  expect(packed.row).toEqual(features.row)
  const encoding = { color: { field: 'state', scale: 'categorical' as const } }
  const lanes = ['row', 'color'] as const
  expect(
    encodeFeatures(packed.table, { ...encoding, row: packed.row }, lanes),
  ).toEqual(
    encodeFeatures(features.table, { ...encoding, row: features.row }, lanes),
  )
})

test('a flatten over the packed alignments answers each species row as the records do', async () => {
  const table = await mafFeatureTable(from(blocks), 'chr1')
  const steps = {
    transform: [
      {
        type: 'flatten' as const,
        field: 'alignments',
        key: 'species',
        index: 'n',
      },
    ],
    layers: [{}],
  }
  const packed = layerTables(table, steps).layers[0]!.table
  const features = layerTables(blocks, steps).layers[0]!.table
  expect(packed.length).toBe(5)
  expect(rowsOf(packed)).toEqual(rowsOf(features))
  expect(packed.row(1).get('seq')).toBe('ACTTGGA-GT')
  expect(packed.row(1).get('context')).toEqual({
    leftStatus: 'C',
    leftCount: 0,
    rightStatus: 'I',
    rightCount: 12,
  })
})

test('a row stating no strand reads +1, as the MAF display draws it', async () => {
  const table = await mafFeatureTable(
    from([
      new MafFeature(
        'b',
        0,
        2,
        'chr1',
        0,
        { hg38: { chr: 'chr1', srcStart: 0, seq: 'AC' } },
        'AC',
      ),
    ]),
    'chr1',
  )
  const rows = layerTables(table, {
    transform: [{ type: 'flatten', field: 'alignments', key: 'species' }],
    layers: [{}],
  }).layers[0]!.table
  expect(rows.row(0).get('strand')).toBe(1)
})
