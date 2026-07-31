import Flatbush from '@jbrowse/core/util/flatbush'

import { computeVariantCells } from './computeVariantCells.ts'

import type { ProcessedSource } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

function makeFeature(props: Record<string, unknown>, id = 'f1'): Feature {
  return {
    id: () => id,
    get: (k: string) => props[k],
    toJSON: () => ({}),
  } as unknown as Feature
}

// The worker resolves every filtered variant's genotypes once (computeSampleInfo)
// and hands the compute pass the finished lookup, so the tests build the same
// thing rather than an empty map the compute pass would have to fill.
function genotypeLookup(features: Feature[]) {
  return new Map(
    features.map(f => [
      f.id(),
      (f.get('genotypes') as Record<string, string> | undefined) ?? {},
    ]),
  )
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
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'skip',
      featureGenotypes: genotypeLookup([feature]),
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
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'skip',
      featureGenotypes: genotypeLookup([feature]),
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
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'allele',
      referenceDrawingMode: 'skip',
      featureGenotypes: genotypeLookup([feature]),
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
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'allele',
      referenceDrawingMode: 'skip',
      featureGenotypes: genotypeLookup([feature]),
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

  test('every alt-carrying cell takes the flat override; ref and no-call keep theirs', async () => {
    const { getCachedABGR } = await import('../../shared/variantWebglUtils.ts')
    const { REFERENCE_COLOR } = await import('../../shared/constants.ts')
    const override = 'rgb(1,2,3)'
    const result = computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'alleleCount',
      referenceDrawingMode: 'draw',
      featureColor: () => override,
      featureGenotypes: genotypeLookup([feature]),
    })
    const colors = [...result.cellColors]
    const overrideAbgr = getCachedABGR(override)
    const refAbgr = getCachedABGR(REFERENCE_COLOR)
    // both the het (0/1) and hom-alt (1/1) cells take the exact override,
    // regardless of dosage; ref keeps its color, no-call is neither
    expect(colors.filter(c => c === overrideAbgr)).toHaveLength(2)
    expect(colors).toContain(refAbgr)
    expect(result.numCells).toBe(4)
  })
})

describe('insertion glyph inputs', () => {
  const sources: ProcessedSource[] = [
    { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
    { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
  ]
  // A pangenome-style insertion: 1bp of reference, a long explicit ALT. One
  // haplotype carries it, the other is reference.
  const insertion = makeFeature({
    genotypes: { S1: '1|0' },
    FORMAT: [],
    ALT: ['C'.repeat(65481)],
    REF: 'C',
    name: 'ins',
    description: '',
    type: 'insertion',
    start: 100,
    end: 101,
  })

  function run(feature: ReturnType<typeof makeFeature>) {
    return computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'draw',
      featureGenotypes: genotypeLookup([feature]),
    })
  }

  test('featureInsertedBp is the ALT length over the reference span', () => {
    // 65481 of ALT against 1bp of REF. This is the number the cell's own width
    // cannot express, since an insertion consumes no reference.
    expect([...run(insertion).featureInsertedBp]).toEqual([65480])
  })

  test('a deletion or SNP inserts nothing', () => {
    const del = makeFeature({
      genotypes: { S1: '1|0' },
      FORMAT: [],
      ALT: ['C'],
      REF: 'C'.repeat(500),
      name: 'del',
      description: '',
      type: 'deletion',
      start: 100,
      end: 600,
    })
    expect([...run(del).featureInsertedBp]).toEqual([0])
  })

  test('only the alt-carrying haplotype is flagged', () => {
    // '1|0' over two haplotype rows: HP0 carries the allele, HP1 does not. A
    // reference cell must stay 0 or the glyph pass would widen it and claim that
    // haplotype has the inserted sequence.
    const r = run(insertion)
    expect(r.numCells).toBe(2)
    expect([...r.cellCarriesAlt].reduce((a, b) => a + b, 0)).toBe(1)
  })
})

describe('spatial index', () => {
  const sources: ProcessedSource[] = [
    { name: 'S1', sampleName: 'S1', HP: 0 },
    { name: 'S2', sampleName: 'S2', HP: 0 },
  ]
  // Two sites far enough apart that a query at one can't reach the other. The
  // second sits past int32 but inside uint32, since the index element type has
  // to cover the same range cellPositions does.
  const site = (start: number, name: string) => ({
    genotypes: { S1: '0/1', S2: '1/1' },
    FORMAT: [],
    ALT: ['A'],
    REF: 'G',
    name,
    description: '',
    type: 'SNV',
    start,
    end: start + 1,
  })
  const near = makeFeature(site(1000, 'near'), 'near')
  const far = makeFeature(site(3_000_000_000, 'far'), 'far')

  const result = computeVariantCells({
    filteredVariants: [
      { feature: near, mostFrequentAlt: '1' },
      { feature: far, mostFrequentAlt: '1' },
    ],
    sources,
    renderingMode: 'alleleCount',
    referenceDrawingMode: 'draw',
    featureGenotypes: genotypeLookup([near, far]),
  })

  // The client rebuilds the index from the transferred buffer, so the element
  // type has to survive the header round-trip (Flatbush.from reads it back).
  const index = Flatbush.from(result.featureIndexData)

  test('holds one interval per feature, not per cell', () => {
    // 2 features x 2 samples = 4 cells. The index is the thing that used to be
    // per-cell; the whole point of item 11 is that it is now numItems=2.
    expect(result.numCells).toBe(4)
    expect(index.numItems).toBe(2)
    expect(index.ArrayType).toBe(Uint32Array)
  })

  test('featurePositions carries the span every cell of a variant shares', () => {
    expect([...result.featurePositions]).toEqual([
      1000, 1001, 3_000_000_000, 3_000_000_001,
    ])
  })

  test('a query at one site returns only that feature', () => {
    expect(index.search(999, 0, 1002, 1)).toEqual([0])
  })

  test('a coordinate above int32 range still indexes and searches', () => {
    expect(index.search(2_999_999_999, 0, 3_000_000_002, 1)).toEqual([1])
  })
})

describe('cell bucket ordering', () => {
  // findCellIndex binary-searches each bucket, so it depends on both being
  // sorted by (featureIndex, rowIndex). Pin that here rather than in the lookup's
  // own tests, since this is the function that has to keep producing it.
  const sources: ProcessedSource[] = ['S1', 'S2', 'S3'].map(s => ({
    name: s,
    sampleName: s,
    HP: 0,
  }))
  // Mixed ref/alt across three samples and two sites, so both buckets are
  // non-empty and interleave features.
  const mk = (start: number, id: string) =>
    makeFeature(
      {
        genotypes: { S1: '0/0', S2: '0/1', S3: '1/1' },
        ALT: ['A'],
        REF: 'G',
        name: id,
        description: '',
        type: 'SNV',
        start,
        end: start + 1,
      },
      id,
    )
  const a = mk(100, 'a')
  const b = mk(200, 'b')

  function sortedWithinBucket(
    result: ReturnType<typeof computeVariantCells>,
    lo: number,
    hi: number,
  ) {
    for (let i = lo + 1; i < hi; i++) {
      const prev =
        result.cellFeatureIndices[i - 1]! * 1e6 + result.cellRowIndices[i - 1]!
      const cur =
        result.cellFeatureIndices[i]! * 1e6 + result.cellRowIndices[i]!
      if (cur <= prev) {
        return false
      }
    }
    return true
  }

  test('drawing reference: both buckets sorted, boundary at refCellCount', () => {
    const result = computeVariantCells({
      filteredVariants: [
        { feature: a, mostFrequentAlt: '1' },
        { feature: b, mostFrequentAlt: '1' },
      ],
      sources,
      renderingMode: 'alleleCount',
      referenceDrawingMode: 'draw',
      featureGenotypes: genotypeLookup([a, b]),
    })
    // one hom-ref cell per site
    expect(result.refCellCount).toBe(2)
    expect(result.numCells).toBe(6)
    expect(sortedWithinBucket(result, 0, result.refCellCount)).toBe(true)
    expect(
      sortedWithinBucket(result, result.refCellCount, result.numCells),
    ).toBe(true)
  })

  test('skipping reference: empty ref bucket, all cells sorted', () => {
    const result = computeVariantCells({
      filteredVariants: [
        { feature: a, mostFrequentAlt: '1' },
        { feature: b, mostFrequentAlt: '1' },
      ],
      sources,
      renderingMode: 'alleleCount',
      referenceDrawingMode: 'skip',
      featureGenotypes: genotypeLookup([a, b]),
    })
    expect(result.refCellCount).toBe(0)
    expect(result.numCells).toBe(4)
    expect(sortedWithinBucket(result, 0, result.numCells)).toBe(true)
  })

  test('ungenotyped samples: buckets stay adjacent and sorted across the gap', () => {
    // Cells are written from both ends of one buffer, so a sample with no
    // genotype leaves a hole between the two write cursors. Both buckets must
    // still come out sorted AND contiguous — a non-empty ref bucket is what
    // makes the gap-closing move non-trivial (the 'skip' case above closes onto
    // index 0, which would also pass if the move were dropped entirely).
    const sparse = makeFeature(
      {
        genotypes: { S1: '0/0', S3: '1/1' },
        ALT: ['A'],
        REF: 'G',
        name: 'sparse',
        description: '',
        type: 'SNV',
        start: 200,
        end: 201,
      },
      'sparse',
    )
    const result = computeVariantCells({
      filteredVariants: [
        { feature: a, mostFrequentAlt: '1' },
        { feature: sparse, mostFrequentAlt: '1' },
      ],
      sources,
      renderingMode: 'alleleCount',
      referenceDrawingMode: 'draw',
      featureGenotypes: genotypeLookup([a, sparse]),
    })
    // 6 slots, 5 cells: S2 has no call at the second site.
    expect(result.numCells).toBe(5)
    expect(result.refCellCount).toBe(2)
    // Asserted as the exact sequence rather than "each bucket is sorted": an
    // unclosed gap leaves a zeroed cell whose (feature 0, row 0) sort key still
    // reads as increasing, so the ordering predicate alone would not catch it.
    // ref bucket: a/S1, sparse/S1 — then non-ref in append order: a/S2, a/S3,
    // sparse/S3.
    expect([...result.cellFeatureIndices]).toEqual([0, 1, 0, 0, 1])
    expect([...result.cellRowIndices]).toEqual([0, 0, 1, 2, 2])
    // The trailing slot must be trimmed off, not left as a zeroed cell that the
    // renderer would paint at bp 0 and the hit-test would binary-search into.
    expect(result.cellPositions).toHaveLength(10)
  })
})

describe('phase-set coloring is opt-in', () => {
  // PS coloring used to switch itself on for any feature whose FORMAT carried
  // PS, which silently replaced the alt-allele colors the legend was still
  // describing and offered no way back. It is now driven by the explicit
  // `colorByPhaseSet` flag (the PHASE_SET_COLOR featureColor sentinel).
  const sources: ProcessedSource[] = [
    { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
    { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
  ]
  const feature = makeFeature({
    genotypes: { S1: '1|0' },
    samples: { S1: { GT: ['1|0'], PS: ['4815162342'] } },
    FORMAT: 'GT:PS',
    ALT: ['A'],
    REF: 'G',
    name: 'v1',
    description: '',
    type: 'SNV',
    start: 100,
    end: 101,
  })

  function altColors(colorByPhaseSet: boolean) {
    const result = computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'skip',
      colorByPhaseSet,
      featureGenotypes: genotypeLookup([feature]),
    })
    return [...result.cellColors.slice(0, result.numCells)]
  }

  test('a PS-carrying feature keeps allele coloring when not asked for', async () => {
    const { getCachedABGR } = await import('../../shared/variantWebglUtils.ts')
    const { PRIMARY_ALT_COLOR } = await import('../../shared/constants.ts')
    // Without the flag the alt cell is the ordinary primary-alt color, even
    // though this feature declares PS — that is the implicit trigger being gone.
    expect(altColors(false)).toEqual([getCachedABGR(PRIMARY_ALT_COLOR)])
    expect(altColors(true)).not.toEqual([getCachedABGR(PRIMARY_ALT_COLOR)])
  })

  test('the hue is derived from the PS id, not the allele', () => {
    // Two samples on the same allele but different phase sets must not share a
    // color under phase-set coloring, and must share one without it.
    const other = makeFeature(
      {
        genotypes: { S1: '1|0' },
        samples: { S1: { GT: ['1|0'], PS: ['999'] } },
        FORMAT: 'GT:PS',
        ALT: ['A'],
        REF: 'G',
        name: 'v2',
        description: '',
        type: 'SNV',
        start: 200,
        end: 201,
      },
      'f2',
    )
    const run = (colorByPhaseSet: boolean) =>
      computeVariantCells({
        filteredVariants: [
          { feature, mostFrequentAlt: '1' },
          { feature: other, mostFrequentAlt: '1' },
        ],
        sources,
        renderingMode: 'phased',
        referenceDrawingMode: 'skip',
        colorByPhaseSet,
        featureGenotypes: genotypeLookup([feature, other]),
      })

    const off = run(false)
    expect(off.cellColors[0]).toBe(off.cellColors[1])

    const on = run(true)
    expect(on.cellColors[0]).not.toBe(on.cellColors[1])
  })
})

// A monomorphic record spells its ALT column '.', which @gmod/vcf parses to
// `undefined`. It still ships (its alleles are called, just all reference) and
// with reference drawing on it gets a cell, so `VariantFeatureInfo.alt` has to
// hold `[]` rather than the raw undefined — every tooltip and the feature widget
// read `.alt` unguarded.
test('a site with no ALT alleles reports an empty alt list', () => {
  const feature = makeFeature({
    genotypes: { S1: '0/0' },
    ALT: undefined,
    REF: 'A',
    name: 'mono1',
    description: 'no alternative alleles',
    type: 'remark',
    start: 100,
    end: 101,
  })
  const result = computeVariantCells({
    filteredVariants: [{ feature, mostFrequentAlt: '1' }],
    sources: [{ name: 'S1', sampleName: 'S1' }],
    renderingMode: 'alleleCount',
    referenceDrawingMode: 'draw',
    featureGenotypes: genotypeLookup([feature]),
  })
  expect(result.numCells).toBe(1)
  expect(result.featureGenotypeMap.f1!.alt).toEqual([])
})

// featureGenotypeMap is the genotype record the anchored sort reads (via the
// interned genotypeCodes), not a log of what got painted. Under the default
// `referenceDrawingMode: 'skip'` a hom-ref call paints nothing, and keying the
// map off the painted cells made every hom-ref row indistinguishable from a
// no-call to `sortSourcesAroundVariant` — while the matrix display, which
// always paints ref, sorted the same data differently.
describe('featureGenotypeMap records every genotype, not only painted ones', () => {
  const sources: ProcessedSource[] = [
    { name: 'S1', sampleName: 'S1' },
    { name: 'S2', sampleName: 'S2' },
  ]
  const feature = makeFeature({
    genotypes: { S1: '0/0', S2: '0/1' },
    ALT: ['G'],
    REF: 'A',
    start: 10,
    end: 11,
  })
  const run = (referenceDrawingMode: string) =>
    computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'alleleCount',
      referenceDrawingMode,
      featureGenotypes: genotypeLookup([feature]),
    })

  test('skip mode keeps the hom-ref genotype while drawing no cell for it', () => {
    const result = run('skip')
    expect(result.numCells).toBe(1)
    expect(result.featureGenotypeMap.f1!.genotypes).toEqual({
      S1: '0/0',
      S2: '0/1',
    })
  })

  test('the genotype map is identical in draw mode', () => {
    expect(run('draw').featureGenotypeMap.f1!.genotypes).toEqual(
      run('skip').featureGenotypeMap.f1!.genotypes,
    )
  })

  test('phased mode keeps a hom-ref call that paints nothing', () => {
    const phasedFeature = makeFeature({
      genotypes: { S1: '0|0', S2: '1|0' },
      ALT: ['G'],
      REF: 'A',
      start: 10,
      end: 11,
    })
    const result = computeVariantCells({
      filteredVariants: [{ feature: phasedFeature, mostFrequentAlt: '1' }],
      sources: [
        { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
        { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
        { name: 'S2 HP0', sampleName: 'S2', HP: 0 },
        { name: 'S2 HP1', sampleName: 'S2', HP: 1 },
      ],
      renderingMode: 'phased',
      referenceDrawingMode: 'skip',
      featureGenotypes: genotypeLookup([phasedFeature]),
    })
    expect(result.numCells).toBe(1)
    expect(result.featureGenotypeMap.f1!.genotypes).toEqual({
      S1: '0|0',
      S2: '1|0',
    })
  })
})
