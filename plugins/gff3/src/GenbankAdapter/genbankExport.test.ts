import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { stringifyGBK } from '../../../../packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/genbank.ts'
import { sourceRecords } from '../../../../packages/core/src/pluggableElementTypes/models/saveTrackFileTypes/util.ts'
import GenbankAdapter from './GenbankAdapter.ts'
import configSchema from './configSchema.ts'
import { fetch, shape } from './genbank.fixture.ts'

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
      'metagenome-source': 'marine metagenome',
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
    '                     /metagenome_source="marine metagenome"',
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

async function exportedNcbiRegion(
  refName: string,
  attributes: Record<string, string>,
) {
  const region = new SimpleFeature({
    uniqueId: 'region',
    refName,
    start: 0,
    end: 5000,
    type: 'region',
    gbkey: 'Src',
    genome: 'genomic',
    ...attributes,
  })
  const exported = await stringifyGBK({
    features: [
      new SimpleFeature({
        uniqueId: 'gene',
        refName,
        start: 100,
        end: 400,
        type: 'gene',
      }),
    ],
    sourceRecords: sourceRecords([region]),
    circularLengths: new Map<string, number>(),
    regions: [],
    assemblyName: 'virus',
    session,
  })
  const lines = exported.split('\n')
  return lines.slice(
    lines.findIndex(line => line.startsWith('SOURCE')),
    lines.findIndex(line => line.startsWith('     gene')),
  )
}

test("NC_045512.2's region writes gb-acronym on SOURCE as NCBI's flatfile does, country as /geo_loc_name and old-name, which INSDC has no qualifier for, as a /note", async () => {
  expect(
    await exportedNcbiRegion('NC_045512.2', {
      dbxref: 'taxon:2697049',
      'collection-date': 'Dec-2019',
      country: 'China',
      'gb-acronym': 'SARS-CoV-2',
      isolate: 'Wuhan-Hu-1',
      mol_type: 'genomic RNA',
      'nat-host': 'Homo sapiens',
      'old-name': 'Wuhan seafood market pneumonia virus',
    }),
  ).toEqual([
    'SOURCE      virus (SARS-CoV-2)',
    '  ORGANISM  virus',
    '            .',
    'FEATURES             Location/Qualifiers',
    '     source          1..300',
    '                     /organism="virus"',
    '                     /db_xref="taxon:2697049"',
    '                     /collection_date="Dec-2019"',
    '                     /geo_loc_name="China"',
    '                     /isolate="Wuhan-Hu-1"',
    '                     /mol_type="genomic RNA"',
    '                     /host="Homo sapiens"',
    '                     /note="old-name: Wuhan seafood market pneumonia virus"',
  ])
})

test("NC_001802.1's region writes gb-synonym on SOURCE as NCBI's flatfile does, and its own note as is", async () => {
  expect(
    await exportedNcbiRegion('NC_001802.1', {
      dbxref: 'taxon:11676',
      'gb-synonym': 'HIV-1',
      mol_type: 'genomic RNA',
      note: 'strain for reference annotation',
    }),
  ).toEqual([
    'SOURCE      virus (HIV-1)',
    '  ORGANISM  virus',
    '            .',
    'FEATURES             Location/Qualifiers',
    '     source          1..300',
    '                     /organism="virus"',
    '                     /db_xref="taxon:11676"',
    '                     /mol_type="genomic RNA"',
    '                     /note="strain for reference annotation"',
  ])
})

test('a source attribute with no INSDC source qualifier is carried as a /note, and a retired one records still carry is kept', async () => {
  expect(
    await exportedSource({
      'gb-anamorph': 'Aspergillus nidulans',
      breed: 'Holstein',
      'tissue-lib': 'tissue library 772',
    }),
  ).toEqual([
    '                     /organism="ecoli"',
    '                     /mol_type="genomic DNA"',
    '                     /note="gb-anamorph: Aspergillus nidulans"',
    '                     /note="breed: Holstein"',
    '                     /tissue_lib="tissue library 772"',
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

describe('GenBank export line width', () => {
  const refName = 'contig1'
  const translation = 'MKTAYIAKQRQISFVKSHFSRQ'.repeat(12)
  const note = Array.from(
    { length: 30 },
    (_, i) => `word${i} of a free text note`,
  ).join(' ')
  const exons = Array.from({ length: 14 }, (_, i) => ({
    uniqueId: `exon${i}`,
    refName,
    start: 1000 + i * 200,
    end: 1000 + i * 200 + 100,
    type: 'exon',
    strand: -1,
  }))
  const features = [
    new SimpleFeature({
      uniqueId: 'noted',
      refName,
      start: 0,
      end: 900,
      type: 'gene',
      note,
    }),
    new SimpleFeature({
      uniqueId: 'coding',
      refName,
      start: 100,
      end: 900,
      type: 'CDS',
      translation,
    }),
    new SimpleFeature({
      uniqueId: 'spliced',
      refName,
      start: 1000,
      end: 3700,
      type: 'mRNA',
      strand: -1,
      subfeatures: exons,
    }),
  ]

  function exportedRecord() {
    return stringifyGBK({
      features,
      sourceRecords: sourceRecords(features),
      circularLengths: new Map<string, number>(),
      regions: [],
      assemblyName: 'test',
      session,
    })
  }

  it('keeps every line within 79 columns', async () => {
    const exported = await exportedRecord()
    expect(exported.split('\n').filter(line => line.length > 79)).toEqual([])
  })

  it('leaves a word longer than a line whole, since a reader would rejoin its halves with a space', async () => {
    const url = `https://example.org/${'a'.repeat(90)}`
    const text = `see ${url} for "the" record`
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genbank-long-word-'))
    const file = path.join(dir, 'word.gbk')
    fs.writeFileSync(
      file,
      await stringifyGBK({
        features: [
          new SimpleFeature({
            uniqueId: 'linked',
            refName,
            start: 0,
            end: 900,
            type: 'gene',
            note: text,
          }),
        ],
        sourceRecords: new Map(),
        circularLengths: new Map<string, number>(),
        regions: [],
        assemblyName: 'test',
        session,
      }),
    )
    const read = await fetch(
      new GenbankAdapter(
        configSchema.create({ genbankLocation: { localPath: file } }),
      ),
      refName,
      0,
      5000,
    ).finally(() => {
      fs.rmSync(dir, { recursive: true, force: true })
    })
    expect(read.find(f => f.get('type') === 'gene')?.get('note')).toBe(text)
  })

  it('reads a wrapped translation, note and location back whole through GenbankAdapter', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genbank-wrap-'))
    const file = path.join(dir, 'wrapped.gbk')
    fs.writeFileSync(file, await exportedRecord())
    const read = await fetch(
      new GenbankAdapter(
        configSchema.create({ genbankLocation: { localPath: file } }),
      ),
      refName,
      0,
      5000,
    ).finally(() => {
      fs.rmSync(dir, { recursive: true, force: true })
    })
    const byType = new Map(read.map(f => [f.get('type'), f]))
    expect(byType.get('gene')?.get('note')).toBe(note)
    expect(byType.get('CDS')?.get('translation')).toBe(translation)
    expect(
      byType
        .get('mRNA')
        ?.get('subfeatures')
        ?.map(f => ({
          start: f.get('start'),
          end: f.get('end'),
          strand: f.get('strand'),
        }))
        .toSorted((a, b) => a.start - b.start),
    ).toEqual(exons.map(e => ({ start: e.start, end: e.end, strand: -1 })))
  })

  it('ends every location line but the last after a comma, since GenbankAdapter rejoins them with nothing and would hide a break inside a span', async () => {
    const lines = (await exportedRecord()).split('\n')
    const start = lines.findIndex(line => line.startsWith('     mRNA'))
    const location = lines.slice(
      start,
      lines.findIndex((line, i) => i > start && !/^ {21}[^ /]/.test(line)),
    )
    expect(location.length).toBeGreaterThan(1)
    expect(location.slice(0, -1).filter(line => !line.endsWith(','))).toEqual(
      [],
    )
  })

  async function exportedNote(text: string) {
    const exported = await stringifyGBK({
      features: [
        new SimpleFeature({
          uniqueId: 'noted',
          refName,
          start: 0,
          end: 900,
          type: 'gene',
          note: text,
        }),
      ],
      sourceRecords: new Map(),
      circularLengths: new Map<string, number>(),
      regions: [],
      assemblyName: 'test',
      session,
    })
    const lines = exported.split('\n')
    const noteLines = lines.slice(
      lines.findIndex(line => line.trimStart().startsWith('/note=')),
      lines.indexOf('ORIGIN'),
    )
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genbank-note-'))
    const file = path.join(dir, 'note.gbk')
    fs.writeFileSync(file, exported)
    const read = await fetch(
      new GenbankAdapter(
        configSchema.create({ genbankLocation: { localPath: file } }),
      ),
      refName,
      0,
      5000,
    ).finally(() => {
      fs.rmSync(dir, { recursive: true, force: true })
    })
    return {
      noteLines,
      readBack: read.find(f => f.get('type') === 'gene')?.get('note'),
    }
  }

  it.each([
    `${'x'.repeat(45)} "q" /usr/local/bin and then a lot more words to wrap here`,
    `${'x'.repeat(40)} a "q" said "hello" /usr/local/bin and then a lot more words to wrap here`,
    `${'x'.repeat(48)} ab /path/to/something and more words follow after the slash`,
    ` ${'y'.repeat(70)} tail`,
  ])(
    'breaks %j where Biopython reads it whole too: no line but the last ends in a quote, and none after the first starts with a slash',
    async text => {
      const { noteLines, readBack } = await exportedNote(text)
      expect(noteLines.length).toBeGreaterThan(1)
      expect(readBack).toBe(text)
      expect(noteLines.slice(0, -1).filter(line => line.endsWith('"'))).toEqual(
        [],
      )
      expect(
        noteLines.slice(1).filter(line => line.trimStart().startsWith('/')),
      ).toEqual([])
    },
  )

  it('breaks at a single space over one in a run, which both readers rejoin as one', async () => {
    const text = `${'x'.repeat(46)} end.  Next words follow to wrap the line here`
    const { noteLines, readBack } = await exportedNote(text)
    expect(noteLines.length).toBeGreaterThan(1)
    expect(readBack).toBe(text)
  })

  it('still wraps text whose every space is in a run, giving up one space at each break', async () => {
    const text = `${'x'.repeat(48)}  two  spaces  here  and  more  words  following  to  wrap`
    const { noteLines, readBack } = await exportedNote(text)
    expect(noteLines.filter(line => line.length > 79)).toEqual([])
    expect(readBack).toBe(text.replace('  two', ' two'))
  })

  it('breaks at a run that fits over a single space past the line', async () => {
    const text = `${'x'.repeat(40)}  aa  bb  cc  dd  ee  ff  gg  hh  ii then the rest`
    const { noteLines } = await exportedNote(text)
    expect(noteLines.length).toBeGreaterThan(1)
    expect(noteLines.filter(line => line.length > 79)).toEqual([])
  })
})

async function readRecord(
  text: string,
  refName: string,
  end: number,
  wholeAcrossOrigin?: boolean,
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genbank-inline-'))
  const file = path.join(dir, 'inline.gbk')
  fs.writeFileSync(file, text)
  return fetch(
    new GenbankAdapter(
      configSchema.create({ genbankLocation: { localPath: file } }),
    ),
    refName,
    0,
    end,
    wholeAcrossOrigin,
  )
    .then(found => found.map(f => new SimpleFeature(f.toJSON())))
    .finally(() => {
      fs.rmSync(dir, { recursive: true, force: true })
    })
}

function exportRecord(
  features: SimpleFeature[],
  circularLengths = new Map<string, number>(),
) {
  return stringifyGBK({
    features: features.filter(f => f.get('gbkey') !== 'Src'),
    sourceRecords: sourceRecords(features),
    circularLengths,
    regions: [],
    assemblyName: 'test',
    session,
  })
}

function featureLines(exported: string, key: string) {
  return exported
    .split('\n')
    .filter(line => line.startsWith(`     ${key.padEnd(16)}`))
}

const qualifierIndent = ' '.repeat(21)

function genbank(locus: string, version: string, features: string[]) {
  return [
    locus,
    `VERSION     ${version}`,
    'FEATURES             Location/Qualifiers',
    ...features,
    '//',
    '',
  ].join('\n')
}

function entry(key: string, location: string, qualifiers: string[]) {
  return [
    `     ${key.padEnd(16)}${location}`,
    ...qualifiers.map(q => `${qualifierIndent}${q}`),
  ].join('\n')
}

describe('SARS-CoV-2 NC_045512.2 ORF1ab, a gene with two CDS and no mRNA', () => {
  const refName = 'NC_045512.2'
  const text = genbank(
    'LOCUS       NC_045512              29903 bp ss-RNA     linear   VRL 18-JUL-2020',
    refName,
    [
      entry('source', '1..29903', [
        '/organism="Severe acute respiratory syndrome coronavirus 2"',
        '/mol_type="genomic RNA"',
      ]),
      entry("5'UTR", '1..265', []),
      entry('gene', '266..21555', [
        '/gene="ORF1ab"',
        '/locus_tag="GU280_gp01"',
      ]),
      entry('CDS', 'join(266..13468,13468..21555)', [
        '/gene="ORF1ab"',
        '/locus_tag="GU280_gp01"',
        '/ribosomal_slippage',
        '/codon_start=1',
        '/product="ORF1ab polyprotein"',
        '/protein_id="YP_009724389.1"',
      ]),
      entry('CDS', '266..13483', [
        '/gene="ORF1ab"',
        '/locus_tag="GU280_gp01"',
        '/codon_start=1',
        '/product="ORF1a polyprotein"',
        '/protein_id="YP_009725295.1"',
      ]),
      entry('mat_peptide', 'join(13442..13468,13468..16236)', [
        '/gene="ORF1ab"',
        '/locus_tag="GU280_gp01"',
        '/product="RNA-dependent RNA polymerase"',
      ]),
    ],
  )
  const gene = (found: SimpleFeature[]) =>
    found.find(f => f.get('type') === 'gene')!
  const matPeptide = (found: SimpleFeature[]) =>
    found.find(f => f.get('type') === 'mat_peptide')!

  test('each CDS is its own feature under the gene, holding its own pieces', async () => {
    const found = await readRecord(text, refName, 29903)
    expect(shape(gene(found))).toEqual([
      'gene',
      265,
      21555,
      1,
      [
        [
          'CDS',
          265,
          21555,
          1,
          [
            ['CDS', 265, 13468, 1, 0],
            ['CDS', 13467, 21555, 1, 0],
          ],
        ],
        ['CDS', 265, 13483, 1, [['CDS', 265, 13483, 1, 0]]],
      ],
    ])
    expect(
      gene(found)
        .get('subfeatures')
        ?.map(f => f.get('product')),
    ).toEqual(['ORF1ab polyprotein', 'ORF1a polyprotein'])
  })

  test('export writes each CDS with its own location and qualifiers, and reads back the same', async () => {
    const found = await readRecord(text, refName, 29903)
    const exported = await exportRecord(found)
    expect(featureLines(exported, 'CDS')).toEqual([
      '     CDS             join(266..13468,13468..21555)',
      '     CDS             266..13483',
    ])
    const cdsBlocks = exported
      .split(/\n(?= {5}\S)/)
      .filter(block => block.startsWith('     CDS'))
    expect(cdsBlocks[0]).toContain('/ribosomal_slippage')
    expect(cdsBlocks[0]).toContain('/product="ORF1ab polyprotein"')
    expect(cdsBlocks[1]).not.toContain('/ribosomal_slippage')
    expect(cdsBlocks[1]).toContain('/product="ORF1a polyprotein"')
    const reread = await readRecord(exported, refName, 29903)
    expect(shape(gene(reread))).toEqual(shape(gene(found)))
  })

  test('a mat_peptide over two spans is written once as their join, and reads back the same', async () => {
    const found = await readRecord(text, refName, 29903)
    expect(shape(matPeptide(found))).toEqual([
      'mat_peptide',
      13441,
      16236,
      1,
      [
        ['mat_peptide', 13441, 13468, 1],
        ['mat_peptide', 13467, 16236, 1],
      ],
    ])
    const exported = await exportRecord(found)
    expect(featureLines(exported, 'mat_peptide')).toEqual([
      '     mat_peptide     join(13442..13468,13468..16236)',
    ])
    const reread = await readRecord(exported, refName, 29903)
    expect(shape(matPeptide(reread))).toEqual(shape(matPeptide(found)))
  })
})
