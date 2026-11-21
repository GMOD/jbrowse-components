import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { stringifyGBK } from '../../../../packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/genbank.ts'
import { sourceRecords } from '../../../../packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/util.ts'
import GenbankAdapter from './GenbankAdapter.ts'
import configSchema from './configSchema.ts'
import { fetch } from './genbank.fixture.ts'

import type { AbstractSessionModel } from '@jbrowse/core/util'

jest.mock('../../../../packages/core/src/util/fetchSeq.ts', () => ({
  fetchSeq: jest.fn(async ({ start, end }: { start: number; end: number }) =>
    'A'.repeat(end - start),
  ),
}))

const session = {
  assemblyManager: { get: () => undefined },
} as unknown as AbstractSessionModel

// the Prokka contig with the source qualifiers a plasmid record from NCBI adds
function prokkaPlasmid(dir: string) {
  const text = fs
    .readFileSync(
      require.resolve('../test_data/prokka_spades_contig.gbk'),
      'utf8',
    )
    .replace(
      '/strain="strain"',
      ['/strain="strain"', '/db_xref="taxon:1639"', '/plasmid="pSPD1"'].join(
        `\n${' '.repeat(21)}`,
      ),
    )
  const file = path.join(dir, 'prokka_plasmid.gbk')
  fs.writeFileSync(file, text)
  return new GenbankAdapter(
    configSchema.create({ genbankLocation: { localPath: file } }),
  )
}

test("a GenBank record saved as GenBank keeps its source feature's qualifiers", async () => {
  const refName = 'NODE_3_length_3306_cov_210.987654'
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genbank-export-'))
  const fetched = await fetch(prokkaPlasmid(dir), refName, 0, 3306)
    .then(features => features.map(f => new SimpleFeature(f.toJSON())))
    .finally(() => {
      fs.rmSync(dir, { recursive: true, force: true })
    })
  const exported = await stringifyGBK({
    features: fetched.filter(f => f.get('gbkey') !== 'Src'),
    sourceRecords: sourceRecords(fetched),
    circularLengths: new Map<string, number>(),
    regions: [],
    assemblyName: 'spades',
    session,
  })
  const lines = exported.split('\n')
  expect(
    lines.slice(
      lines.findIndex(line => line.startsWith('SOURCE')),
      lines.findIndex(line => line.startsWith('     CDS')),
    ),
  ).toEqual([
    'SOURCE      Genus species',
    '  ORGANISM  Genus species',
    '            .',
    'FEATURES             Location/Qualifiers',
    '     source          1..2357',
    '                     /organism="Genus species"',
    '                     /mol_type="genomic DNA"',
    '                     /strain="strain"',
    '                     /db_xref="taxon:1639"',
    '                     /plasmid="pSPD1"',
  ])
  expect(exported).not.toContain('/chromosome=')
  expect(exported).not.toContain('misc_feature')
})

function sourceBlock(exported: string) {
  const lines = exported.split('\n')
  return lines.slice(
    lines.findIndex(line => line.startsWith('     source')),
    lines.findIndex(line => line.startsWith('     gene')),
  )
}

const gene = new SimpleFeature({
  uniqueId: 'gene',
  refName: 'NC_000913.3',
  start: 100,
  end: 400,
  type: 'gene',
  dbxref: 'GeneID:944742',
})

test("an NCBI GFF3 region saved as GenBank's source takes INSDC's qualifier names", async () => {
  const region = new SimpleFeature({
    uniqueId: 'region',
    refName: 'NC_000913.3',
    start: 0,
    end: 4641652,
    type: 'region',
    dbxref: 'taxon:511145',
    is_circular: 'true',
    gbkey: 'Src',
    genome: 'chromosome',
    mol_type: 'genomic DNA',
    strain: 'K-12',
    substr: 'MG1655',
  })
  const exported = await stringifyGBK({
    features: [gene],
    sourceRecords: sourceRecords([region, gene]),
    circularLengths: new Map<string, number>(),
    regions: [],
    assemblyName: 'ecoli',
    session,
  })
  expect(sourceBlock(exported).slice(1)).toEqual([
    '                     /organism="ecoli"',
    '                     /db_xref="taxon:511145"',
    '                     /mol_type="genomic DNA"',
    '                     /strain="K-12"',
    '                     /sub_strain="MG1655"',
  ])
  expect(exported).toContain('/db_xref="GeneID:944742"')
})

async function exportedSource(attributes: Record<string, string>) {
  const region = new SimpleFeature({
    uniqueId: 'region',
    refName: 'NC_000913.3',
    start: 0,
    end: 5000,
    type: 'region',
    gbkey: 'Src',
    mol_type: 'genomic DNA',
    ...attributes,
  })
  const exported = await stringifyGBK({
    features: [gene],
    sourceRecords: sourceRecords([region, gene]),
    circularLengths: new Map<string, number>(),
    regions: [],
    assemblyName: 'ecoli',
    session,
  })
  return sourceBlock(exported).slice(1)
}

test("NCBI GFF3's hyphenated source attributes take INSDC's qualifier names", async () => {
  expect(
    await exportedSource({
      'collection-date': 'Dec-2019',
      'nat-host': 'Homo sapiens',
      'isolation-source': 'bronchoalveolar lavage fluid',
      'lat-lon': '30.6 N 114.3 E',
      'plasmid-name': 'pO157',
      'culture-collection': 'ATCC:700927',
    }),
  ).toEqual([
    '                     /organism="ecoli"',
    '                     /mol_type="genomic DNA"',
    '                     /collection_date="Dec-2019"',
    '                     /host="Homo sapiens"',
    '                     /isolation_source="bronchoalveolar lavage fluid"',
    '                     /lat_lon="30.6 N 114.3 E"',
    '                     /plasmid="pO157"',
    '                     /culture_collection="ATCC:700927"',
  ])
})

test.each([
  ['mitochondrion', ['                     /organelle="mitochondrion"']],
  ['chloroplast', ['                     /organelle="plastid:chloroplast"']],
  [
    'kinetoplast',
    ['                     /organelle="mitochondrion:kinetoplast"'],
  ],
  ['genomic', []],
  ['chromosome', []],
  ['plasmid', []],
])(
  "NCBI GFF3's genome=%s is written as INSDC's /organelle only for an organelle",
  async (genome, organelle) => {
    expect(await exportedSource({ genome })).toEqual([
      '                     /organism="ecoli"',
      ...organelle,
      '                     /mol_type="genomic DNA"',
    ])
  },
)

test('a source with its own /organelle keeps it over the genome attribute', async () => {
  expect(
    await exportedSource({ genome: 'mitochondrion', organelle: 'plastid' }),
  ).toEqual([
    '                     /organism="ecoli"',
    '                     /mol_type="genomic DNA"',
    '                     /organelle="plastid"',
  ])
})

test('a record with two source features takes the widest as its own', async () => {
  const source = (uniqueId: string, end: number, organism: string) =>
    new SimpleFeature({
      uniqueId,
      refName: 'NC_000913.3',
      start: 0,
      end,
      type: 'region',
      gbkey: 'Src',
      organism,
    })
  const exported = await stringifyGBK({
    features: [gene],
    sourceRecords: sourceRecords([
      source('insert', 300, 'Homo sapiens'),
      source('whole', 5000, 'synthetic construct'),
      source('tail', 50, 'Escherichia coli'),
    ]),
    circularLengths: new Map<string, number>(),
    regions: [],
    assemblyName: 'ecoli',
    session,
  })
  expect(exported).toContain('  ORGANISM  synthetic construct')
})
