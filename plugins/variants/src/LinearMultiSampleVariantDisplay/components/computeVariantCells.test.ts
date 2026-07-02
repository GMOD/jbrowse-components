import { computeVariantCells } from './computeVariantCells.ts'

import type { ProcessedSource } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

function makeFeature(props: Record<string, unknown>): Feature {
  return {
    id: () => 'f1',
    get: (k: string) => props[k],
    toJSON: () => ({}),
  } as unknown as Feature
}

describe('computeVariantCells phased genotypes', () => {
  // Two diploid samples, each split into two haplotype sources.
  const feature = makeFeature({
    genotypes: { S1: '1|0', S2: '1|1' },
    FORMAT: [],
    ALT: ['A'],
    REF: 'G',
    name: 'v1',
    description: '',
    type: 'SNV',
    start: 100,
    end: 101,
  })

  const sources: ProcessedSource[] = [
    { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
    { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
    { name: 'S2 HP0', sampleName: 'S2', HP: 0 },
    { name: 'S2 HP1', sampleName: 'S2', HP: 1 },
  ]

  test('featureGenotypeMap genotypes keyed by sampleName not HP-suffixed name', () => {
    const result = computeVariantCells({
      mafs: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'skip',
      genotypesCache: new Map(),
    })

    const genotypes = result.featureGenotypeMap.f1!.genotypes
    expect(genotypes.S1).toBe('1|0')
    expect(genotypes.S2).toBe('1|1')
    expect(genotypes['S1 HP0']).toBeUndefined()
    expect(genotypes['S1 HP1']).toBeUndefined()
    expect(genotypes['S2 HP0']).toBeUndefined()
    expect(genotypes['S2 HP1']).toBeUndefined()
  })
})

describe('computeVariantCells insertion hit bounds', () => {
  const sources: ProcessedSource[] = [{ name: 'S1', sampleName: 'S1', HP: 0 }]

  // An insertion's drawn down-triangle spans [start, renderEnd]; the flatbush
  // hit/highlight bounds must match that rendered extent (not the ~1bp VCF end)
  // so the whole triangle is mouse-overable.
  test('flatbush end spans the alt-allele width', () => {
    const feature = makeFeature({
      genotypes: { S1: '1' },
      ALT: ['ACGTACGTAC'], // 10bp insertion
      REF: 'A',
      name: 'ins1',
      description: '',
      type: 'insertion',
      start: 100,
      end: 101,
    })
    const result = computeVariantCells({
      mafs: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'allele',
      referenceDrawingMode: 'skip',
      genotypesCache: new Map(),
    })
    expect(result.cellPositions[0]).toBe(100)
    expect(result.cellPositions[1]).toBe(110)
  })

  test('flatbush end spans SVLEN for symbolic insertions', () => {
    const feature = makeFeature({
      genotypes: { S1: '1' },
      ALT: ['<INS>'],
      REF: 'A',
      INFO: { SVLEN: [250] },
      name: 'ins2',
      description: '',
      type: 'insertion',
      start: 100,
      end: 101,
    })
    const result = computeVariantCells({
      mafs: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'allele',
      referenceDrawingMode: 'skip',
      genotypesCache: new Map(),
    })
    expect(result.cellPositions[0]).toBe(100)
    expect(result.cellPositions[1]).toBe(350)
  })

  test('symbolic insertion without SVLEN stays a point (ignores <INS> string length)', () => {
    const feature = makeFeature({
      genotypes: { S1: '1' },
      ALT: ['<INS>'],
      REF: 'A',
      INFO: {},
      name: 'ins3',
      description: '',
      type: 'insertion',
      start: 100,
      end: 101,
    })
    const result = computeVariantCells({
      mafs: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'allele',
      referenceDrawingMode: 'skip',
      genotypesCache: new Map(),
    })
    expect(result.cellPositions[0]).toBe(100)
    // end-start (1bp), not the length of the literal "<INS>" string (5)
    expect(result.cellPositions[1]).toBe(101)
  })
})

describe('computeVariantCells featureColor override', () => {
  const sources: ProcessedSource[] = [
    { name: 'S1', sampleName: 'S1', HP: 0 },
    { name: 'S2', sampleName: 'S2', HP: 0 },
    { name: 'S3', sampleName: 'S3', HP: 0 },
  ]
  const feature = makeFeature({
    // S1 hom-ref, S2 het-alt (carrying), S3 no-call
    genotypes: { S1: '0/0', S2: '0/1', S3: './.' },
    ALT: ['A'],
    REF: 'G',
    name: 'v1',
    description: '',
    type: 'SNV',
    start: 100,
    end: 101,
  })

  test('alt-carrying cell takes the override color; ref and no-call keep theirs', async () => {
    const { getCachedABGR } = await import('../../shared/variantWebglUtils.ts')
    const { REFERENCE_COLOR } = await import('../../shared/constants.ts')
    const override = 'rgb(1,2,3)'
    const result = computeVariantCells({
      mafs: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'alleleCount',
      referenceDrawingMode: 'draw',
      featureColor: () => override,
      genotypesCache: new Map(),
    })
    const colors = [...result.cellColors]
    const overrideAbgr = getCachedABGR(override)
    const refAbgr = getCachedABGR(REFERENCE_COLOR)
    // exactly the single het-alt cell is painted with the override
    expect(colors.filter(c => c === overrideAbgr)).toHaveLength(1)
    // ref cell is untouched, no-call cell is neither ref nor override
    expect(colors).toContain(refAbgr)
    expect(colors.filter(c => c === overrideAbgr || c === refAbgr)).toHaveLength(
      2,
    )
    expect(result.numCells).toBe(3)
  })
})
