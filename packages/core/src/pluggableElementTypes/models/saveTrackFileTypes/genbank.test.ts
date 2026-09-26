import { fetchSeq } from '../../../util/fetchSeq.ts'
import SimpleFeature from '../../../util/simpleFeature.ts'
import {
  formatFeatWithSubfeatures,
  insdcFeatureKey,
  stringifyGBK,
} from './genbank.ts'

import type { AbstractSessionModel } from '../../../util/index.ts'

jest.mock('../../../util/fetchSeq.ts', () => ({
  fetchSeq: jest.fn(async ({ start, end }: { start: number; end: number }) =>
    'A'.repeat(end - start),
  ),
}))

// Helper function to create a feature, ensuring a unique ID is set
// for the SimpleFeature instance while using data.id for GenBank attributes.
function createFeature(data: Record<string, any>): SimpleFeature {
  if (!data.id) {
    throw new Error('Test feature data must have an id')
  }
  return new SimpleFeature({ id: `${data.id}-unique`, data })
}

const mockSession = {} as AbstractSessionModel

describe('GenBank export', () => {
  beforeEach(() => {
    jest.mocked(fetchSeq).mockClear()
  })

  it('can export a simple feature', async () => {
    const f = createFeature({
      id: 'gene1',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'gene',
      name: 'gene_name',
      source: 'test_source',
      note: 'some note',
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toMatchSnapshot()
    expect(fetchSeq).toHaveBeenCalledTimes(1)
  })

  it('can export a feature with subfeatures (mRNA, CDS, exon)', async () => {
    const f = createFeature({
      id: 'gene2',
      refName: 'chr1',
      start: 1000,
      end: 2000,
      type: 'gene',
      subfeatures: [
        {
          id: 'mrna1',
          type: 'mRNA',
          start: 1000,
          end: 2000,
          subfeatures: [
            {
              id: 'exon1',
              type: 'exon',
              start: 1000,
              end: 1200,
            },
            {
              id: 'cds1',
              type: 'CDS',
              start: 1050,
              end: 1150,
            },
            {
              id: 'exon2',
              type: 'exon',
              start: 1800,
              end: 2000,
            },
            {
              id: 'cds2',
              type: 'CDS',
              start: 1850,
              end: 1950,
            },
          ],
        },
      ],
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toMatchSnapshot()
    expect(fetchSeq).toHaveBeenCalledTimes(1)
  })

  it('handles multiple top-level features', async () => {
    const f1 = createFeature({
      id: 'gene3',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'gene',
    })
    const f2 = createFeature({
      id: 'gene4',
      refName: 'chr1',
      start: 300,
      end: 400,
      type: 'gene',
    })
    const result = await stringifyGBK({
      features: [f1, f2],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toMatchSnapshot()
    expect(fetchSeq).toHaveBeenCalledTimes(1)
  })

  it('returns empty string for no features', async () => {
    const result = await stringifyGBK({
      features: [],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toBe('')
    expect(fetchSeq).not.toHaveBeenCalled()
  })

  it('handles features on negative strand', async () => {
    const f = createFeature({
      id: 'gene5',
      refName: 'chr1',
      start: 500,
      end: 600,
      type: 'gene',
      strand: -1,
      subfeatures: [
        {
          id: 'mrna2',
          type: 'mRNA',
          start: 500,
          end: 600,
          strand: -1,
          subfeatures: [
            {
              id: 'cds3',
              type: 'CDS',
              start: 520,
              end: 580,
              strand: -1,
            },
          ],
        },
      ],
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toMatchSnapshot()
    expect(fetchSeq).toHaveBeenCalledTimes(1)
  })

  it('handles custom attributes', async () => {
    const f = createFeature({
      id: 'gene6',
      refName: 'chr1',
      start: 700,
      end: 800,
      type: 'gene',
      custom_tag: 'custom_value',
      another_tag: ['val1', 'val2'],
      empty_array: [],
      null_val: null,
      undef_val: undefined,
      complex_obj: { key: 'value' },
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toMatchSnapshot()
    expect(fetchSeq).toHaveBeenCalledTimes(1)
  })

  it('formats ORIGIN section with proper line breaks for long sequences', async () => {
    jest
      .mocked(fetchSeq)
      .mockImplementationOnce(
        async ({ start, end }: { start: number; end: number }) => {
          const bases = 'ACGT'
          let seq = ''
          for (let i = 0; i < end - start; i++) {
            seq += bases[i % 4]!
          }
          return seq
        },
      )

    const f = createFeature({
      id: 'gene7',
      refName: 'chr1',
      start: 0,
      end: 150,
      type: 'gene',
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toMatchSnapshot()
    // Verify ORIGIN section has multiple lines
    expect(result).toContain('ORIGIN')
    expect(result).toContain('        1 ')
    expect(result).toContain('       61 ')
    expect(result).toContain('      121 ')
  })

  it('handles single CDS without join() wrapper', async () => {
    const f = createFeature({
      id: 'gene8',
      refName: 'chr1',
      start: 100,
      end: 300,
      type: 'gene',
      subfeatures: [
        {
          id: 'mrna3',
          type: 'mRNA',
          start: 100,
          end: 300,
          subfeatures: [
            {
              id: 'cds_single',
              type: 'CDS',
              start: 120,
              end: 280,
            },
          ],
        },
      ],
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toMatchSnapshot()
    // Single CDS should not have join()
    expect(result).toContain('CDS             21..180')
    expect(result).not.toContain('join(21..180)')
  })

  it('gives a type with no feature key misc_feature, keeping the term', async () => {
    const f = createFeature({
      id: 'gene9',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'very_long_feature_type_name',
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toMatchSnapshot()
    expect(result).toContain('     misc_feature    1..100')
    expect(result).toContain('/note="very_long_feature_type_name"')
  })

  it('handles features without explicit strand (defaults to positive)', async () => {
    const f = createFeature({
      id: 'gene10',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'gene',
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    // Should not have complement() wrapper
    expect(result).toContain('gene            1..100')
    expect(result).not.toContain('complement')
  })

  it('handles mRNA with only exons (no CDS)', async () => {
    const f = createFeature({
      id: 'gene11',
      refName: 'chr1',
      start: 0,
      end: 500,
      type: 'gene',
      subfeatures: [
        {
          id: 'mrna4',
          type: 'mRNA',
          start: 0,
          end: 500,
          subfeatures: [
            {
              id: 'exon3',
              type: 'exon',
              start: 0,
              end: 100,
            },
            {
              id: 'exon4',
              type: 'exon',
              start: 400,
              end: 500,
            },
          ],
        },
      ],
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toMatchSnapshot()
    // Gene spans the whole locus; the mRNA is a spliced join of its exons
    expect(result).toContain('gene            1..500')
    expect(result).toContain('mRNA            join(1..100,401..500)')
    expect(result).not.toContain('CDS')
  })

  it('filters out null and undefined attribute values', async () => {
    const f = createFeature({
      id: 'gene12',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'gene',
      valid_attr: 'valid_value',
      null_attr: null,
      undefined_attr: undefined,
    })
    const result = await stringifyGBK({
      features: [f],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toContain('/valid_attr="valid_value"')
    expect(result).not.toContain('null_attr')
    expect(result).not.toContain('undefined_attr')
    expect(result).not.toContain('"null"')
    expect(result).not.toContain('"undefined"')
  })

  // GenBank cannot express a span crossing a reference sequence. Taking
  // min(start)/max(end) over every feature and labelling it with the first
  // one's refName described a stretch of sequence that does not exist, and
  // fetched an ORIGIN over it.
  it('writes one record per reference sequence', async () => {
    const result = await stringifyGBK({
      features: [
        createFeature({
          id: 'geneA',
          refName: 'ctgA',
          start: 100,
          end: 200,
          type: 'gene',
        }),
        createFeature({
          id: 'geneB',
          refName: 'ctgB',
          start: 500,
          end: 600,
          type: 'gene',
        }),
      ],
      assemblyName: 'volvox',
      session: mockSession,
    })

    expect(result.split('\n').filter(l => l.startsWith('LOCUS'))).toHaveLength(
      2,
    )
    expect(result).toContain('ACCESSION   ctgA')
    expect(result).toContain('ACCESSION   ctgB')
    expect(
      jest
        .mocked(fetchSeq)
        .mock.calls.map(([{ refName, start, end }]) => [refName, start, end]),
    ).toEqual([
      ['ctgA', 100, 200],
      ['ctgB', 500, 600],
    ])
  })

  it('exports nothing for no features', async () => {
    expect(
      await stringifyGBK({
        features: [],
        assemblyName: 'volvox',
        session: mockSession,
      }),
    ).toBe('')
  })

  // A positional parser reads the length out of columns 30-40, so nothing
  // before it may overflow its own field. The region string did: naming this
  // one after its refName is what keeps it inside 16 columns.
  it('keeps the LOCUS fields in their columns on a long refName', async () => {
    const result = await stringifyGBK({
      features: [
        createFeature({
          id: 'geneA',
          refName: 'NC_000017.11',
          start: 7668402,
          end: 7687550,
          type: 'gene',
        }),
      ],
      assemblyName: 'hg38',
      session: mockSession,
    })

    const locus = result.split('\n')[0]!
    expect(locus.slice(0, 12)).toBe('LOCUS       ')
    expect(locus.slice(12, 28)).toBe('NC_000017.11    ')
    expect(locus.slice(29, 40)).toBe('      19148')
    expect(result).toContain(
      'DEFINITION  NC_000017.11:7668403..7687550 from hg38.',
    )
  })

  // The only writer that fetches anything. Dropping the pair left closing the
  // dialog with a whole-gene sequence read still running, and its download
  // unnamed while it ran.
  it('carries the signal and a status slot into the ORIGIN fetch', async () => {
    const { signal } = new AbortController()
    const statusCallback = jest.fn()
    await stringifyGBK({
      features: [
        createFeature({
          id: 'geneA',
          refName: 'ctgA',
          start: 100,
          end: 200,
          type: 'gene',
        }),
      ],
      assemblyName: 'volvox',
      session: mockSession,
      signal,
      statusCallback,
    })

    const [arg] = jest.mocked(fetchSeq).mock.calls[0]!
    expect(arg.signal).toBe(signal)
    arg.statusCallback?.('Downloading sequence')
    expect(statusCallback).toHaveBeenCalledWith('Downloading sequence')
  })
})

describe('formatFeatWithSubfeatures', () => {
  it('formats a simple feature correctly', () => {
    const f = new SimpleFeature({
      id: 'test-unique',
      data: {
        id: 'test_feat',
        type: 'gene',
        start: 100,
        end: 200,
        strand: 1,
      },
    })
    const result = formatFeatWithSubfeatures({ feature: f, minPos: 100 })
    expect(result).toContain('gene            1..100')
    expect(result).toContain('/label="test_feat"')
  })

  it('formats negative strand feature with complement', () => {
    const f = new SimpleFeature({
      id: 'test-unique',
      data: {
        id: 'test_feat',
        type: 'gene',
        start: 100,
        end: 200,
        strand: -1,
      },
    })
    const result = formatFeatWithSubfeatures({ feature: f, minPos: 100 })
    expect(result).toContain('complement(1..100)')
  })

  it('sorts CDS segments by position', () => {
    const f = new SimpleFeature({
      id: 'test-unique',
      data: {
        id: 'gene_unsorted',
        type: 'gene',
        start: 0,
        end: 1000,
        subfeatures: [
          {
            id: 'mrna_unsorted',
            type: 'mRNA',
            start: 0,
            end: 1000,
            subfeatures: [
              // CDS segments intentionally out of order
              {
                id: 'cds_c',
                type: 'CDS',
                start: 700,
                end: 900,
              },
              {
                id: 'cds_a',
                type: 'CDS',
                start: 100,
                end: 200,
              },
              {
                id: 'cds_b',
                type: 'CDS',
                start: 400,
                end: 500,
              },
            ],
          },
        ],
      },
    })
    const result = formatFeatWithSubfeatures({ feature: f, minPos: 0 })
    // CDS should be sorted: 101..200, 401..500, 701..900
    expect(result).toContain('join(101..200,401..500,701..900)')
  })

  it('handles nested subfeatures recursively', () => {
    const f = new SimpleFeature({
      id: 'test-unique',
      data: {
        id: 'gene_nested',
        type: 'gene',
        start: 0,
        end: 1000,
        subfeatures: [
          {
            id: 'mrna_nested',
            type: 'mRNA',
            start: 0,
            end: 1000,
            subfeatures: [
              {
                id: 'utr5',
                type: 'five_prime_UTR',
                start: 0,
                end: 100,
              },
              {
                id: 'cds_a',
                type: 'CDS',
                start: 100,
                end: 400,
              },
              {
                id: 'cds_b',
                type: 'CDS',
                start: 600,
                end: 900,
              },
              {
                id: 'utr3',
                type: 'three_prime_UTR',
                start: 900,
                end: 1000,
              },
            ],
          },
        ],
      },
    })
    const result = formatFeatWithSubfeatures({ feature: f, minPos: 0 })
    expect(result).toContain('gene            1..1000')
    expect(result).toContain('mRNA            1..1000')
    expect(result).toContain('CDS             join(101..400,601..900)')
    expect(result).toContain("5'UTR           1..100")
    expect(result).toContain("3'UTR           901..1000")
  })
})

// The key column holds one of a closed list, so a SO term is not a key by being
// a type. Everything below went out under a key no reader recognizes, and the
// snapshots could not see it because an unknown key parses fine and just draws
// as nothing in particular.
describe('INSDC feature keys', () => {
  it.each([
    ['gene', 'gene'],
    ['mRNA', 'mRNA'],
    ['CDS', 'CDS'],
    ['exon', 'exon'],
    ['five_prime_UTR', "5'UTR"],
    ['three_prime_UTR', "3'UTR"],
    // what SnapGene draws a primer for; in-silico PCR footprints come in as
    // `primer` and drew as nothing
    ['primer', 'primer_bind'],
    ['transcript', 'mRNA'],
    ['promoter', 'regulatory'],
    ['guide_rna', 'misc_feature'],
    ['PAM', 'misc_feature'],
    ['motif', 'misc_feature'],
    ['PCR_product', 'misc_feature'],
    ['match', 'misc_feature'],
    ['match_part', 'misc_feature'],
  ])('%s is written as %s', (type, key) => {
    expect(insdcFeatureKey(type)).toBe(key)
  })

  it('never writes a key wider than the column', () => {
    for (const type of ['gene', 'misc_difference', 'transit_peptide', 'zzz']) {
      expect(insdcFeatureKey(type).length).toBeLessThanOrEqual(15)
    }
  })

  // /gene is the gene symbol. Threading it off any parent that happened to have
  // children labelled an hgPcr product `/gene="100 bp"` and a BLAT hit
  // `/gene="YourSeq 99.1%"`, which reads downstream as a gene of that name.
  it('does not give a non-gene parent a /gene symbol', () => {
    const product = createFeature({
      id: 'p1',
      refName: 'chr1',
      start: 800,
      end: 900,
      type: 'PCR_product',
      name: '100 bp',
      subfeatures: [
        {
          id: 'fwd',
          type: 'primer',
          start: 800,
          end: 820,
          name: 'forward primer',
        },
      ],
    })
    const result = formatFeatWithSubfeatures({ feature: product, minPos: 800 })
    expect(result).not.toContain('/gene=')
    expect(result).toContain('primer_bind')
    expect(result).toContain('/label="forward primer"')
  })

  it('still threads the symbol through a real gene group', () => {
    const gene = createFeature({
      id: 'g1',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'gene',
      name: 'TP53',
      subfeatures: [{ id: 'm1', type: 'mRNA', start: 0, end: 100 }],
    })
    const result = formatFeatWithSubfeatures({ feature: gene, minPos: 0 })
    expect(result.match(/\/gene="TP53"/g)).toHaveLength(2)
  })
})

// The LOCUS line is read positionally, so a field that moves one column makes a
// record no parser accepts — and the snapshots above cannot see it, because
// they pin the bytes we emit rather than the format they have to be in.
// Biopython refused all nine of them over a topology field written from 55
// instead of 56. These are the fixed slots the GenBank flat-file spec states,
// 1-based and inclusive, as every real NCBI record spells them.
const locusColumns = [
  [1, 5, 'LOCUS'],
  [6, 12, '       '],
  [29, 29, ' '],
  [41, 44, ' bp '],
  [45, 47, '   '],
  [55, 55, ' '],
  [64, 64, ' '],
  [68, 68, ' '],
] as const

describe('GenBank LOCUS line', () => {
  it('puts every fixed field in the column the spec names', async () => {
    const locus = (
      await stringifyGBK({
        features: [
          createFeature({
            id: 'gene1',
            refName: 'chr1',
            start: 100,
            end: 200,
            type: 'gene',
          }),
        ],
        assemblyName: 'testAssembly',
        session: mockSession,
      })
    ).split('\n')[0]!

    expect(locus).toHaveLength(79)
    // paired with the column so a failure names which slot moved
    for (const [from, to, expected] of locusColumns) {
      expect([from, locus.slice(from - 1, to)]).toEqual([from, expected])
    }
    expect(locus.slice(12, 28).trimEnd()).toBe('chr1')
    expect(locus.slice(29, 40).trim()).toBe('100')
    expect(locus.slice(47, 54).trimEnd()).toBe('DNA')
    expect(locus.slice(55, 63).trimEnd()).toBe('linear')
    expect(locus.slice(68, 79)).toMatch(/^\d{2}-[A-Z]{3}-\d{4}$/)
  })
})
