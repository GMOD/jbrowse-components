import SimpleFeature from '../../../util/simpleFeature'

import { fetchSequence } from './fetchSequence'
import { stringifyGBK } from './genbank'

import type { AbstractSessionModel } from '../../../util'

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
})
