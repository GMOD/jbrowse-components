import { computeVariantMatrixCells } from './computeVariantMatrixCells.ts'

import type { ProcessedSource } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

function makeFeature(props: Record<string, unknown>): Feature {
  return {
    id: () => 'f1',
    get: (k: string) => props[k],
    toJSON: () => ({}),
  } as unknown as Feature
}

describe('computeVariantMatrixCells phased raw callGenotype path', () => {
  // Two diploid samples, each split into two haplotype sources.
  // S1: alleles [1, 0] → "1|0"   S2: alleles [1, 1] → "1|1"
  const callGt = new Int8Array([1, 0, 1, 1])
  const callGtPhased = new Uint8Array([1, 1])

  const feature = makeFeature({
    callGenotype: callGt,
    callGenotypePhased: callGtPhased,
    ploidy: 2,
    sampleNames: ['S1', 'S2'],
    FORMAT: [],
    ALT: ['A'],
    REF: 'G',
    name: 'v1',
    description: '',
    start: 100,
    end: 101,
  })

  const sources: ProcessedSource[] = [
    { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
    { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
    { name: 'S2 HP0', sampleName: 'S2', HP: 0 },
    { name: 'S2 HP1', sampleName: 'S2', HP: 1 },
  ]

  test('genotypes keyed by sampleName not HP-suffixed name', () => {
    const result = computeVariantMatrixCells({
      mafs: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      genotypesCache: new Map(),
    })

    const genotypes = result.featureData[0]!.genotypes
    expect(genotypes.S1).toBe('1|0')
    expect(genotypes.S2).toBe('1|1')
    expect(genotypes['S1 HP0']).toBeUndefined()
    expect(genotypes['S1 HP1']).toBeUndefined()
    expect(genotypes['S2 HP0']).toBeUndefined()
    expect(genotypes['S2 HP1']).toBeUndefined()
  })
})
