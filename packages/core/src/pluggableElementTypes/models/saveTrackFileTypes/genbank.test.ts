import { fetchSequence } from './fetchSequence.ts'
import { formatFeatWithSubfeatures, stringifyGBK } from './genbank.ts'
import SimpleFeature from '../../../util/simpleFeature.ts'

import type { AbstractSessionModel } from '../../../util/index.ts'

// Mock the fetchSequence function from its new module
jest.mock('./fetchSequence', () => {
  return {
    fetchSequence: jest.fn(async ({ region }) => {
      const { start, end } = region
      return 'A'.repeat(end - start)
    }),
  }
})

// Helper function to create a feature, ensuring a unique ID is set
// for the SimpleFeature instance while using data.id for GenBank attributes.
function createFeature(data: Record<string, any>): SimpleFeature {
  if (!data.id) {
    throw new Error('Test feature data must have an id')
  }
  return new SimpleFeature({ id: `${data.id}-unique`, data })
}

// Mock session object - simplified as fetchSequence is fully mocked
const mockSession = {
  name: 'testSession',
  id: 'testSessionId',
  rpcManager: {} as any,
  assemblyManager: {
    get: jest.fn(() => ({
      getCanonicalRefName: jest.fn(refName => refName),
    })),
  } as any,
} as AbstractSessionModel

describe('GenBank export', () => {
  // No need for fetchSequenceSpy or before/after hooks for spying anymore
  // The mock is global for the module

  beforeEach(() => {
    // Clear mock calls before each test
    // Need to get the mocked fetchSequence to clear it
    ;(fetchSequence as jest.Mock).mockClear()
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
    expect(fetchSequence).toHaveBeenCalledTimes(1)
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
    expect(fetchSequence).toHaveBeenCalledTimes(1)
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
    expect(fetchSequence).toHaveBeenCalledTimes(1)
  })

  it('returns empty string for no features', async () => {
    const result = await stringifyGBK({
      features: [],
      assemblyName: 'testAssembly',
      session: mockSession,
    })
    expect(result).toBe('')
    expect(fetchSequence).not.toHaveBeenCalled()
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
    expect(fetchSequence).toHaveBeenCalledTimes(1)
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
    expect(fetchSequence).toHaveBeenCalledTimes(1)
  })

  it('formats ORIGIN section with proper line breaks for long sequences', async () => {
    ;(fetchSequence as jest.Mock).mockImplementationOnce(async ({ region }) => {
      const { start, end } = region
      // Return a sequence with different bases to verify formatting
      const bases = 'ACGT'
      let seq = ''
      for (let i = 0; i < end - start; i++) {
        seq += bases[i % 4]
      }
      return seq
    })

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

  it('truncates long feature type names to 16 characters', async () => {
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
    // Type should be truncated to 16 chars
    expect(result).toContain('very_long_feature')
    expect(result).not.toContain('very_long_feature_type_name')
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
    // Should have gene and mRNA but no CDS line
    expect(result).toContain('gene            1..500')
    expect(result).toContain('mRNA            1..500')
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
    const result = formatFeatWithSubfeatures(f, 100)
    expect(result).toContain('gene            1..100')
    expect(result).toContain('/name="test_feat"')
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
    const result = formatFeatWithSubfeatures(f, 100)
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
    const result = formatFeatWithSubfeatures(f, 0)
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
    const result = formatFeatWithSubfeatures(f, 0)
    expect(result).toContain('gene            1..1000')
    expect(result).toContain('mRNA            1..1000')
    expect(result).toContain('CDS             join(101..400,601..900)')
    expect(result).toContain('five_prime_UTR  1..100')
    expect(result).toContain('three_prime_UTR 901..1000')
  })
})
