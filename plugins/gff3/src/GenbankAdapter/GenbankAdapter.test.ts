import { readFileSync } from 'node:fs'

import { originTailId } from '@jbrowse/core/util/originCut'

import { parseFeatureTable, parseRecords } from '../genbank/parseGenbank.ts'
import { adapters, fetch, protein, shape } from './genbank.fixture.ts'

import type { Feature } from '@jbrowse/core/util'

/** The `/translation` the file gives the CDS whose `qualifier` is `value`. */
function fileTranslation(file: string, qualifier: string, value: string) {
  const text = readFileSync(require.resolve(`../test_data/${file}`), 'utf8')
  const record = parseRecords(text)[0]!
  return parseFeatureTable(record.featureLines)
    .find(e => e.key === 'CDS' && e.qualifiers.get(qualifier)?.[0] === value)!
    .qualifiers.get('translation')![0]!
}

describe('a hand-written chromosome and plasmid', () => {
  const { features, sequence } = adapters('two_records.gbk')

  test('each record is a refName, by VERSION else by LOCUS name', async () => {
    expect(await features.getRefNames()).toEqual(['contig_1', 'pTEST.1'])
    expect(await sequence.getRefNames()).toEqual(['contig_1', 'pTEST.1'])
  })

  test('regions span each ORIGIN, the circular one marked', async () => {
    expect(await sequence.getRegions()).toEqual([
      { refName: 'contig_1', start: 0, end: 120 },
      { refName: 'pTEST.1', start: 0, end: 60, circular: true },
    ])
  })

  test('sequence slices are the ORIGIN bases, uppercased', async () => {
    expect(
      await sequence.getSequence({ refName: 'contig_1', start: 0, end: 12 }),
    ).toBe('GCTAAAGACAAT')
    expect(
      await sequence.getSequence({ refName: 'contig_1', start: 58, end: 62 }),
    ).toBe('CGCT')
    expect(
      await sequence.getSequence({ refName: 'pTEST.1', start: 55, end: 70 }),
    ).toBe('GAGGC')
  })

  test('the chromosome in the shapes the GFF3 adapter builds', async () => {
    const found = await fetch(features, 'contig_1', 0, 120)
    expect(found.map(shape)).toEqual([
      ['region', 0, 120, 1],
      [
        'misc_feature',
        0,
        9,
        1,
        [
          ['misc_feature', 0, 5, 1],
          ['misc_feature', 6, 9, 1],
        ],
      ],
      [
        'gene',
        9,
        90,
        1,
        [
          [
            'mRNA',
            9,
            90,
            1,
            [
              ['exon', 9, 30, 1],
              ['exon', 49, 90, 1],
              ['CDS', 14, 30, 1, 0],
              ['CDS', 49, 80, 1, 2],
            ],
          ],
        ],
      ],
      ['misc_binding', 39, 41, 1],
      ['misc_feature', 94, 95, 1],
      ['gene', 99, 118, -1, [['CDS', 99, 118, -1, 1]]],
    ])
  })

  test('a CDS inside its gene’s mRNA hangs under the mRNA, phased per span', async () => {
    const [, , gene] = await fetch(features, 'contig_1', 0, 120)
    const mrna = gene!.get('subfeatures')![0]!
    const cds = mrna.get('subfeatures')!.filter(f => f.get('type') === 'CDS')
    expect(
      cds.map(f => [f.get('start'), f.get('end'), f.get('phase')]),
    ).toEqual([
      [14, 30, 0],
      [49, 80, 2],
    ])
  })

  test('qualifiers read back as written', async () => {
    const [region, , gene, , quoted, pseudo] = await fetch(
      features,
      'contig_1',
      0,
      120,
    )
    expect(region!.get('gbkey')).toBe('Src')
    expect(region!.get('is_circular')).toBeUndefined()
    expect(region!.get('organism')).toBe('Testus testus')
    expect(gene!.get('name')).toBe('abcA')
    const cds = gene!.get('subfeatures')![0]!.get('subfeatures')![2]!
    expect(cds.get('product')).toBe('ABC transporter, putative; 2=3 & 50%')
    expect(cds.get('note')).toBe(
      'a note long enough that the writer wrapped it onto a second line',
    )
    expect(cds.get('translation')).toBe('MKVLAAGILVPRSW')
    expect(cds.get('transl_table')).toBeUndefined()
    expect(pseudo!.get('subfeatures')![0]!.get('pseudo')).toBe('true')
    expect(quoted!.get('note')).toBe('He said "hi"')
  })

  test('feature ids are unique and stable across fetches', async () => {
    const ids = (fs: Feature[]): string[] =>
      fs.flatMap(f => [f.id(), ...ids(f.get('subfeatures') ?? [])])
    const first = ids(await fetch(features, 'contig_1', 0, 120))
    expect(new Set(first).size).toBe(first.length)
    expect(ids(await fetch(features, 'contig_1', 0, 120))).toEqual(first)
  })

  test('a CDS wrapping the plasmid origin is cut there', async () => {
    const [tail] = (await fetch(features, 'pTEST.1', 0, 5)).filter(
      f => f.get('type') === 'CDS',
    )
    const [head] = (await fetch(features, 'pTEST.1', 50, 55)).filter(
      f => f.get('type') === 'CDS',
    )
    expect([head!.get('start'), head!.get('end')]).toEqual([49, 60])
    expect([tail!.get('start'), tail!.get('end')]).toEqual([0, 10])
    expect(tail!.id()).toBe(originTailId(head!.id()))
    const [whole] = (await fetch(features, 'pTEST.1', 0, 5, true)).filter(
      f => f.get('type') === 'CDS',
    )
    expect([whole!.get('start'), whole!.get('end')]).toEqual([49, 70])
  })

  test('the plasmid’s source is a circular region', async () => {
    const [region] = await fetch(features, 'pTEST.1', 0, 60)
    expect(region!.get('type')).toBe('region')
    expect(region!.get('is_circular')).toBe('true')
  })

  test('a join of complements and a wrapping complement', async () => {
    const found = await fetch(features, 'pTEST.1', 0, 60, true)
    expect(
      found
        .filter(f => f.get('type') !== 'CDS')
        .slice(1)
        .map(shape),
    ).toEqual([
      [
        'misc_feature',
        19,
        35,
        -1,
        [
          ['misc_feature', 29, 35, -1],
          ['misc_feature', 19, 25, -1],
        ],
      ],
      ['rep_origin', 54, 63, -1],
    ])
  })
})

describe('human mitochondrion NC_012920.1', () => {
  const { features, sequence } = adapters('human_mito_NC_012920.1.gb')
  const refName = 'NC_012920.1'
  const length = 16569

  test('one circular sequence', async () => {
    expect(await features.getRefNames()).toEqual([refName])
    expect(await sequence.getRegions()).toEqual([
      { refName, start: 0, end: length, circular: true },
    ])
    expect(await sequence.getSequence({ refName, start: 0, end: 10 })).toBe(
      'GATCACAGGT',
    )
  })

  test('the D-loop is cut into two pieces at the origin', async () => {
    const dloops = async (start: number, end: number, whole?: boolean) =>
      (await fetch(features, refName, start, end, whole))
        .filter(f => f.get('type') === 'D-loop')
        .map(f => [f.get('start'), f.get('end'), f.get('strand')])
    expect(await dloops(0, 100)).toEqual([[0, 576, -1]])
    expect(await dloops(16100, 16200)).toEqual([[16023, 16569, -1]])
    expect(await dloops(0, length)).toEqual([
      [0, 576, -1],
      [16023, 16569, -1],
    ])
    expect(await dloops(0, 100, true)).toEqual([[16023, 17145, -1]])
  })

  test.each([
    ['ND1', 3306, 4262],
    ['ND6', 14148, 14673],
  ])(
    '%s translates under transl_table 2 to its /translation',
    async (name, start, end) => {
      const gene = (await fetch(features, refName, start, end)).find(
        f => f.get('type') === 'gene' && f.get('name') === name,
      )!
      expect(gene.get('subfeatures')![0]!.get('transl_table')).toBe('2')
      expect(await protein(sequence, refName, gene, length)).toBe(
        fileTranslation('human_mito_NC_012920.1.gb', 'gene', name),
      )
    },
  )
})

describe('edge cases on a circle and two same-named exports', () => {
  const { features, sequence } = adapters('edge_cases.gbk')

  test('a repeated record name takes a suffix, the same in both adapters', async () => {
    const names = ['x.1', 'Exported', 'Exported_2']
    expect(await features.getRefNames()).toEqual(names)
    expect(await sequence.getRefNames()).toEqual(names)
    expect((await sequence.getRegions()).map(r => r.end)).toEqual([
      1000, 50, 40,
    ])
    const [second] = await fetch(features, 'Exported_2', 0, 40)
    expect(second?.get('name')).toBe('second')
  })

  test('a blank line inside FEATURES drops no later feature', async () => {
    const found = await fetch(features, 'x.1', 0, 1000)
    expect(found.find(f => f.get('locus_tag') === 'X_minus')).toBeDefined()
  })

  test('spans wrap the origin only for a join that crosses it', async () => {
    const found = await fetch(features, 'x.1', 0, 1000, true)
    const byNote = (note: string) =>
      shape(found.find(f => f.get('note') === note)!)
    expect(byNote('ordered').slice(0, 3)).toEqual(['misc_feature', 804, 860])
    expect(byNote('trans-spliced').slice(0, 3)).toEqual(['misc_RNA', 299, 720])
    expect(byNote('descending, no trans_splicing').slice(0, 3)).toEqual([
      'misc_feature',
      299,
      720,
    ])
    expect(byNote('abutting')).toEqual(['misc_feature', 9, 30, 1])
    const [abutting] = await fetch(features, 'Exported', 0, 50)
    expect(shape(abutting!)).toEqual(['misc_feature', 0, 20, 1])
  })
  test('a gene with /locus_tag and /gene holds children naming only /gene', async () => {
    const gene = (await fetch(features, 'x.1', 300, 700)).find(
      f => f.get('locus_tag') === 'X_iso',
    )
    expect(
      gene?.get('subfeatures')?.map(f => [f.get('type'), f.get('product')]),
    ).toEqual(
      expect.arrayContaining([
        ['mRNA', 'short isoform'],
        ['mRNA', 'long isoform'],
      ]),
    )
  })

  test('a child past the origin hangs under its origin-wrapping gene', async () => {
    const wrapGene = (fs: Feature[]) =>
      fs.find(f => f.get('locus_tag') === 'X_wrap' && f.get('type') === 'gene')
    const whole = wrapGene(await fetch(features, 'x.1', 0, 100, true))
    expect(shape(whole!)).toEqual([
      'gene',
      900,
      1200,
      1,
      [['CDS', 1009, 1200, 1, 0]],
    ])
    const tail = wrapGene(await fetch(features, 'x.1', 0, 100))
    expect(shape(tail!)).toEqual(['gene', 0, 200, 1, [['CDS', 9, 200, 1, 0]]])
  })

  test('each isoform’s CDS hangs under the mRNA whose exons it fits', async () => {
    const gene = (await fetch(features, 'x.1', 300, 700)).find(
      f => f.get('locus_tag') === 'X_iso',
    )
    expect(gene?.get('subfeatures')?.map(shape)).toEqual([
      [
        'mRNA',
        299,
        700,
        1,
        [
          ['exon', 299, 400, 1],
          ['exon', 599, 700, 1],
          ['CDS', 349, 400, 1, 0],
          ['CDS', 599, 650, 1, 0],
        ],
      ],
      [
        'mRNA',
        299,
        700,
        1,
        [
          ['exon', 299, 400, 1],
          ['exon', 449, 500, 1],
          ['exon', 599, 700, 1],
          ['CDS', 349, 400, 1, 0],
          ['CDS', 449, 500, 1, 0],
          ['CDS', 599, 650, 1, 0],
        ],
      ],
    ])
  })

  test('spans naming the record’s own accession are kept', async () => {
    const found = await fetch(features, 'x.1', 800, 850)
    expect(shape(found.find(f => f.get('note') === 'own accession')!)).toEqual([
      'misc_feature',
      809,
      840,
      1,
      [
        ['misc_feature', 809, 820, 1],
        ['misc_feature', 829, 840, 1],
      ],
    ])
  })
})

describe('a record with no ORIGIN sequence', () => {
  const { features, sequence } = adapters('contig_only.gb')

  test('still gives its features', async () => {
    expect(await features.getRefNames()).toEqual(['NZ_CP000001.1'])
  })

  test('fails the sequence, naming the record and the format to download', async () => {
    await expect(sequence.getRegions()).rejects.toThrow(
      /NZ_CP000001\.1.*no ORIGIN sequence.*rettype=gbwithparts/,
    )
  })
})

describe('phage phiX174 NC_001422.1', () => {
  const { features, sequence } = adapters('phiX174_NC_001422.1.gb')
  const refName = 'NC_001422.1'
  const length = 5386

  test('gene A, which wraps the origin, translates whole', async () => {
    const gene = (await fetch(features, refName, 0, 10, true)).find(
      f => f.get('locus_tag') === 'phiX174p01' && f.get('type') === 'gene',
    )!
    expect([gene.get('start'), gene.get('end')]).toEqual([3980, 5522])
    expect(await protein(sequence, refName, gene, length)).toBe(
      fileTranslation('phiX174_NC_001422.1.gb', 'locus_tag', 'phiX174p01'),
    )
  })

  test('a CDS under an mRNA of its gene nests gene, mRNA, CDS', async () => {
    const gene = (await fetch(features, refName, 400, 410)).find(
      f => f.get('locus_tag') === 'phiX174p07',
    )!
    expect(shape(gene)).toEqual([
      'gene',
      357,
      991,
      1,
      [
        [
          'mRNA',
          357,
          991,
          1,
          [
            ['exon', 357, 991, 1],
            ['CDS', 389, 848, 1, 0],
          ],
        ],
      ],
    ])
  })
})
