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

describe('computeVariantCells phased no-call vs unphased', () => {
  // Missing calls (`./.`, `.|.`) are no-calls, not unphased data — they must
  // render as NO_CALL_COLOR, distinct from the black "Unphased" fill a genuine
  // unphased call (`0/1`) gets.
  const feature = makeFeature({
    genotypes: { S1: './.', S2: '0/1', S3: '.|.', S4: '0|1' },
    FORMAT: [],
    ALT: ['A'],
    REF: 'G',
    name: 'v1',
    description: '',
    type: 'SNV',
    start: 100,
    end: 101,
  })
  const sources: ProcessedSource[] = ['S1', 'S2', 'S3', 'S4'].flatMap(s => [
    { name: `${s} HP0`, sampleName: s, HP: 0 },
    { name: `${s} HP1`, sampleName: s, HP: 1 },
  ])

  test('missing genotypes render no-call, real unphased renders black', async () => {
    const { getCachedABGR } = await import('../../shared/variantWebglUtils.ts')
    const { BLACK_ABGR, NO_CALL_COLOR } =
      await import('../../shared/constants.ts')
    const result = computeVariantCells({
      mafs: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'skip',
      genotypesCache: new Map(),
    })
    const colors = [...result.cellColors]
    const noCallAbgr = getCachedABGR(NO_CALL_COLOR)
    expect(noCallAbgr).not.toBe(BLACK_ABGR)
    // S1 (./.) and S3 (.|.) → 4 no-call cells; S2 (0/1) → 2 black cells; S4
    // (0|1) → 1 alt cell (ref haplotype skipped since referenceDrawingMode).
    expect(colors.filter(c => c === noCallAbgr)).toHaveLength(4)
    expect(colors.filter(c => c === BLACK_ABGR)).toHaveLength(2)
    expect(result.numCells).toBe(7)
  })
})

describe('computeVariantCells insertion bounds', () => {
  const sources: ProcessedSource[] = [{ name: 'S1', sampleName: 'S1', HP: 0 }]

  // Insertions render as a plain barcode line like SNPs — drawn at [start, end],
  // never widened to the alt-allele / SVLEN span (that used to feed a distinct
  // down-triangle glyph, since removed).
  test('insertion draws at [start, end] regardless of alt-allele width', () => {
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
    expect(result.cellPositions[1]).toBe(101)
  })

  test('symbolic insertion draws at [start, end] regardless of SVLEN', () => {
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
    expect(result.cellPositions[1]).toBe(101)
  })
})

describe('computeVariantCells featureColor override', () => {
  const sources: ProcessedSource[] = [
    { name: 'S1', sampleName: 'S1', HP: 0 },
    { name: 'S2', sampleName: 'S2', HP: 0 },
    { name: 'S3', sampleName: 'S3', HP: 0 },
    { name: 'S4', sampleName: 'S4', HP: 0 },
  ]
  const feature = makeFeature({
    // S1 hom-ref, S2 het-alt, S3 hom-alt, S4 no-call
    genotypes: { S1: '0/0', S2: '0/1', S3: '1/1', S4: './.' },
    ALT: ['A'],
    REF: 'G',
    name: 'v1',
    description: '',
    type: 'SNV',
    start: 100,
    end: 101,
  })

  test('hom-alt takes the exact override; het is dosage-shaded; ref/no-call keep theirs', async () => {
    const { getCachedABGR } = await import('../../shared/variantWebglUtils.ts')
    const { REFERENCE_COLOR } = await import('../../shared/constants.ts')
    const { colord } = await import('@jbrowse/core/util/colord')
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
    // het (0/1, dosage 0.5) is the override mixed halfway to white
    const hetShaded = getCachedABGR(colord(override).mix('#ffffff', 0.5).toHex())
    // hom-alt renders the exact override (matches the legend swatch)
    expect(colors.filter(c => c === overrideAbgr)).toHaveLength(1)
    // het-alt renders the dosage-shaded color, distinct from the exact override
    expect(colors.filter(c => c === hetShaded)).toHaveLength(1)
    expect(hetShaded).not.toBe(overrideAbgr)
    expect(colors).toContain(refAbgr)
    expect(result.numCells).toBe(4)
  })
})
