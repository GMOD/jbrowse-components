import VcfParser from '@gmod/vcf'
import Flatbush from '@jbrowse/core/util/flatbush'

import VcfFeature from '../../VcfFeature/index.ts'
import {
  buildSampleIndex,
  decodeGenotype,
  internGenotype,
} from '../../shared/genotypeCodec.ts'
import { computeVariantCells } from './computeVariantCells.ts'

import type { ProcessedSource } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

// A real VcfFeature, for the phase-set tests. PS reaches the cell loops through
// `processFormatFields`, so a plain-object mock with a `samples` field would no
// longer exercise the path at all — it would silently fall back to allele
// coloring and keep passing. Parsing a line is also the only way the FORMAT
// column, the GT and the PS stay consistent with each other by construction.
function vcfFeature(line: string, samples: string[], id = 'f1'): Feature {
  const parser = new VcfParser({
    header:
      '##fileformat=VCFv4.2\n' +
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="gt">\n' +
      '##FORMAT=<ID=PS,Number=1,Type=Integer,Description="ps">\n' +
      `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${samples.join('\t')}\n`,
  })
  return new VcfFeature({ variant: parser.parseLine(line), parser, id })
}

function makeFeature(props: Record<string, unknown>, id = 'f1'): Feature {
  return {
    id: () => id,
    get: (k: string) => props[k],
    toJSON: () => ({}),
  } as unknown as Feature
}

// The worker interns every filtered variant's genotypes once
// (computeSampleInfo) and hands the compute pass the codes plus the dict they
// resolve against, so the tests build the same thing rather than a lookup the
// compute pass would have to fill.
function genotypeArgs(features: Feature[]) {
  const genotypeDict: string[] = []
  const dictIndex = new Map<string, number>()
  const sampleNames: string[] = []
  const sampleIndex = new Map<string, number>()
  const featureGenotypeCodes = new Map<string, Uint32Array>()
  const genotypesOf = (f: Feature) =>
    (f.get('genotypes') as Record<string, string> | undefined) ?? {}
  for (const f of features) {
    for (const name in genotypesOf(f)) {
      if (!sampleIndex.has(name)) {
        sampleIndex.set(name, sampleNames.length)
        sampleNames.push(name)
      }
    }
  }
  for (const f of features) {
    const codes = new Uint32Array(sampleNames.length)
    const gts = genotypesOf(f)
    for (const name in gts) {
      codes[sampleIndex.get(name)!] = internGenotype(
        gts[name]!,
        genotypeDict,
        dictIndex,
      )
    }
    featureGenotypeCodes.set(f.id(), codes)
  }
  return { featureGenotypeCodes, genotypeDict, sampleNames }
}

// Decode a shipped feature's codes back to the sampleName -> genotype map the
// assertions read. Absent samples (code 0) drop out, exactly as the client's
// `decodeGenotype` reports them.
function decodeAll(
  info: { genotypeCodes: Uint32Array },
  args: { genotypeDict: string[]; sampleNames: string[] },
) {
  const sampleIndex = buildSampleIndex(args.sampleNames)
  const out: Record<string, string> = {}
  for (const sampleName of args.sampleNames) {
    const genotype = decodeGenotype(
      args.genotypeDict,
      sampleIndex,
      info.genotypeCodes,
      sampleName,
    )
    if (genotype !== undefined) {
      out[sampleName] = genotype
    }
  }
  return out
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
    const args = genotypeArgs([feature])
    const result = computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'skip',
      ...args,
    })

    // The codes are aligned to the sample order, so the HP-suffixed row names
    // are not addresses into them at all — which is the point: they are render
    // rows, and four of them share these two samples' calls.
    expect(decodeAll(result.featureGenotypeMap.f1!, args)).toEqual({
      S1: '1|0',
      S2: '1|1',
    })
    expect(args.sampleNames).toEqual(['S1', 'S2'])
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
      ...genotypeArgs([feature]),
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

describe('computeVariantCells haploid genotypes in phased mode', () => {
  // A haploid call has one allele and nothing left to phase, so it draws on the
  // sample's single haplotype row by its allele — not as the black "Unphased"
  // fill, which the legend does not even claim for it (hasUnphased counts only a
  // called `/` genotype). Reachable whenever a file mixes haploid with phased
  // diploid calls: pangenome callsets are haploid per assembly path, and chrY /
  // chrM are haploid in an ordinary human callset.
  const feature = makeFeature({
    genotypes: { S1: '1|0', S2: '1', S3: '0', S4: '.' },
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
    { name: 'S3 HP0', sampleName: 'S3', HP: 0 },
    { name: 'S4 HP0', sampleName: 'S4', HP: 0 },
  ]

  test('haploid calls color by allele, never the unphased fill', async () => {
    const { getCachedABGR } = await import('../../shared/variantWebglUtils.ts')
    const { BLACK_ABGR, NO_CALL_COLOR, PRIMARY_ALT_COLOR, REFERENCE_COLOR } =
      await import('../../shared/constants.ts')
    const result = computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'draw',
      ...genotypeArgs([feature]),
    })
    const byRow = new Map<number, number>()
    for (let i = 0; i < result.numCells; i++) {
      byRow.set(result.cellRowIndices[i]!, result.cellColors[i]!)
    }
    expect(byRow.get(0)).toBe(getCachedABGR(PRIMARY_ALT_COLOR)) // S1 HP0: 1|0
    expect(byRow.get(1)).toBe(getCachedABGR(REFERENCE_COLOR)) // S1 HP1: 1|0
    expect(byRow.get(2)).toBe(getCachedABGR(PRIMARY_ALT_COLOR)) // S2: 1
    expect(byRow.get(3)).toBe(getCachedABGR(REFERENCE_COLOR)) // S3: 0
    expect(byRow.get(4)).toBe(getCachedABGR(NO_CALL_COLOR)) // S4: .
    expect([...byRow.values()]).not.toContain(BLACK_ABGR)
  })
})

describe('computeVariantCells mixed ploidy in phased mode', () => {
  // A triploid sample raises maxPloidy to 3, so phased expansion gives every
  // sample three haplotype rows. The diploid sample has nothing to draw on its
  // third — it must paint no cell there rather than reading past the end of its
  // allele list and flagging the `undefined` as an "other alt allele".
  const feature = makeFeature({
    genotypes: { S1: '0|1|1', S2: '0|1' },
    FORMAT: [],
    ALT: ['A'],
    REF: 'G',
    name: 'v1',
    description: '',
    type: 'SNV',
    start: 100,
    end: 101,
  })
  const sources: ProcessedSource[] = ['S1', 'S2'].flatMap(s => [
    { name: `${s} HP0`, sampleName: s, HP: 0 },
    { name: `${s} HP1`, sampleName: s, HP: 1 },
    { name: `${s} HP2`, sampleName: s, HP: 2 },
  ])

  test('a haplotype row the sample does not have draws no cell', () => {
    const result = computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'draw',
      ...genotypeArgs([feature]),
    })
    const rows = [...result.cellRowIndices.slice(0, result.numCells)].sort()
    // S1 rows 0,1,2 and S2 rows 3,4 — never row 5 (S2 HP2).
    expect(rows).toEqual([0, 1, 2, 3, 4])
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
      ...genotypeArgs([feature]),
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
      ...genotypeArgs([feature]),
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
      ...genotypeArgs([feature]),
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
      ...genotypeArgs([feature]),
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
    // one haplotype at full dosage, one at zero
    expect([...r.cellAltDosage].sort((a, b) => a - b)).toEqual([0, 255])
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
    ...genotypeArgs([near, far]),
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
      ...genotypeArgs([a, b]),
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
      ...genotypeArgs([a, b]),
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
      ...genotypeArgs([a, sparse]),
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
  const feature = vcfFeature(
    '1\t101\tv1\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:4815162342',
    ['S1'],
  )

  function altColors(colorByPhaseSet: boolean) {
    const result = computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'skip',
      colorByPhaseSet,
      ...genotypeArgs([feature]),
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
    const other = vcfFeature(
      '1\t201\tv2\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:999',
      ['S1'],
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
        ...genotypeArgs([feature, other]),
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
    ...genotypeArgs([feature]),
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
  const args = genotypeArgs([feature])
  const run = (referenceDrawingMode: string) =>
    computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'alleleCount',
      referenceDrawingMode,
      ...args,
    })

  test('skip mode keeps the hom-ref genotype while drawing no cell for it', () => {
    const result = run('skip')
    expect(result.numCells).toBe(1)
    expect(decodeAll(result.featureGenotypeMap.f1!, args)).toEqual({
      S1: '0/0',
      S2: '0/1',
    })
  })

  test('the genotype map is identical in draw mode', () => {
    expect(decodeAll(run('draw').featureGenotypeMap.f1!, args)).toEqual(
      decodeAll(run('skip').featureGenotypeMap.f1!, args),
    )
  })

  // The record is the adapter's whole genotype map, shipped by reference — not
  // a copy assembled from the rows being drawn. That is what makes it the same
  // object the matrix display ships, so the two cannot disagree, and it is why
  // narrowing the rows (a subtree filter) cannot quietly narrow the record the
  // anchored sort reads.
  test('a sample the display is not drawing still has its genotype recorded', () => {
    const result = computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources: [{ name: 'S2', sampleName: 'S2' }],
      renderingMode: 'alleleCount',
      referenceDrawingMode: 'skip',
      ...args,
    })
    expect(result.numCells).toBe(1)
    expect(decodeAll(result.featureGenotypeMap.f1!, args)).toEqual({
      S1: '0/0',
      S2: '0/1',
    })
  })

  test('phased mode keeps a hom-ref call that paints nothing', () => {
    const phasedFeature = makeFeature({
      genotypes: { S1: '0|0', S2: '1|0' },
      ALT: ['G'],
      REF: 'A',
      start: 10,
      end: 11,
    })
    const phasedArgs = genotypeArgs([phasedFeature])
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
      ...phasedArgs,
    })
    expect(result.numCells).toBe(1)
    expect(decodeAll(result.featureGenotypeMap.f1!, phasedArgs)).toEqual({
      S1: '0|0',
      S2: '1|0',
    })
  })
})

describe('computeVariantCells cellAltDosage', () => {
  // `cellAltDosage` is what gates the insertion-glyph overlay, so a cell whose
  // sample has no call at the site must be 0 or the figure claims that haplotype
  // carries the inserted sequence. It cannot be read back off the resolved cell
  // color: allele-count mode blends its no-call shade through colord and hands
  // back a hex (`#bfaa40`), which is never string-equal to the `hsl(...)`
  // NO_CALL_COLOR literal the test used to be. That mis-flagged every no-call as
  // alt-carrying, and it is how `pangenome/maf` painted an insertion marker on
  // NCTC86's row at a site where the VCF calls `.` for it.
  const sources: ProcessedSource[] = [
    { name: 'S1', sampleName: 'S1', HP: 0 },
    { name: 'S2', sampleName: 'S2', HP: 0 },
    { name: 'S3', sampleName: 'S3', HP: 0 },
    { name: 'S4', sampleName: 'S4', HP: 0 },
    { name: 'S5', sampleName: 'S5', HP: 0 },
  ]
  // S1/S2 haploid, as a pangenome callset (pggb / `vg deconstruct`) writes them;
  // S3-S5 diploid.
  const feature = makeFeature({
    genotypes: { S1: '1', S2: '.', S3: './.', S4: '0/1', S5: '0/0' },
    ALT: ['ACGTACGTACGT'],
    REF: 'A',
    name: 'ins1',
    description: '',
    type: 'insertion',
    start: 100,
    end: 101,
  })

  function carriesAltByRow(
    f: Feature,
    srcs: ProcessedSource[],
    renderingMode: string,
  ) {
    const result = computeVariantCells({
      filteredVariants: [{ feature: f, mostFrequentAlt: '1' }],
      sources: srcs,
      renderingMode,
      referenceDrawingMode: 'draw',
      ...genotypeArgs([f]),
    })
    const byRow = new Map<number, number>()
    for (let i = 0; i < result.numCells; i++) {
      byRow.set(result.cellRowIndices[i]!, result.cellAltDosage[i]!)
    }
    return byRow
  }

  test('a no-call cell does not carry the alt (allele-count mode)', () => {
    const byRow = carriesAltByRow(feature, sources, 'alleleCount')
    expect(byRow.get(0)).toBe(255) // S1 `1`   — haploid alt is FULL dosage
    expect(byRow.get(1)).toBe(0) // S2 `.`   — haploid no-call
    expect(byRow.get(2)).toBe(0) // S3 `./.` — diploid no-call
    expect(byRow.get(3)).toBe(128) // S4 `0/1` — het, so a paler marker
    expect(byRow.get(4)).toBe(0) // S5 `0/0` — reference
  })

  // Phased mode was already right — getPhasedColor returns the NO_CALL_COLOR
  // constant itself — but it is the half that decides the pangenome figure, so
  // it is pinned rather than assumed. Per haplotype row here, not per sample.
  test('a no-call cell does not carry the alt (phased mode)', () => {
    const phased = makeFeature({
      genotypes: { S1: '1', S2: '.', S3: '.|.', S4: '0|1' },
      ALT: ['ACGTACGTACGT'],
      REF: 'A',
      start: 100,
      end: 101,
    })
    const byRow = carriesAltByRow(
      phased,
      [
        { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
        { name: 'S2 HP0', sampleName: 'S2', HP: 0 },
        { name: 'S3 HP0', sampleName: 'S3', HP: 0 },
        { name: 'S3 HP1', sampleName: 'S3', HP: 1 },
        { name: 'S4 HP0', sampleName: 'S4', HP: 0 },
        { name: 'S4 HP1', sampleName: 'S4', HP: 1 },
      ],
      'phased',
    )
    // Always full strength in phased mode: a row is one haplotype, so zygosity
    // is the pattern down a sample's rows rather than a shade.
    expect(byRow.get(0)).toBe(255) // S1 `1`   — haploid alt
    expect(byRow.get(1)).toBe(0) // S2 `.`   — haploid no-call
    expect(byRow.get(2)).toBe(0) // S3 `.|.`
    expect(byRow.get(3)).toBe(0) // S3 `.|.`
    expect(byRow.get(4)).toBe(0) // S4 `0|1` HP0 — reference haplotype
    expect(byRow.get(5)).toBe(255) // S4 `0|1` HP1
  })

  // A half-called genotype does carry the sequence on the allele that was
  // called, so it widens; only the all-`.` cells above must not.
  test('a partly-called genotype still carries the alt', () => {
    const partial = makeFeature({
      genotypes: { S1: './1', S2: './0' },
      ALT: ['ACGTACGTACGT'],
      REF: 'A',
      start: 100,
      end: 101,
    })
    const byRow = carriesAltByRow(
      partial,
      [
        { name: 'S1', sampleName: 'S1', HP: 0 },
        { name: 'S2', sampleName: 'S2', HP: 0 },
      ],
      'alleleCount',
    )
    // `.` counts toward the denominator: the sample carries the sequence on the
    // one haplotype that was called, which is half dosage.
    expect(byRow.get(0)).toBe(128) // `./1`
    expect(byRow.get(1)).toBe(0) // `./0`
  })
})

describe('phase-set coloring classifies from the allele, not the color', () => {
  // The PS path is the one place left that resolves a color per cell rather
  // than through a memoized style, and it used to read `isRef`/`isAlt` back off
  // that color by comparing it to the constants. That is the exact test that
  // shipped a marker onto a no-call row once the allele-count path started
  // blending its no-call shade to a hex. Sound here only because
  // `getPhasedColor` happens to return the constants by identity — so the
  // classification now comes from the allele, and this pins it.
  const sources: ProcessedSource[] = [
    { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
    { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
    { name: 'S2 HP0', sampleName: 'S2', HP: 0 },
    { name: 'S2 HP1', sampleName: 'S2', HP: 1 },
  ]
  // S1 carries the insertion on one haplotype and no-calls the other; S2 is
  // hom-ref. A PS is declared, so the per-cell colour path runs.
  const feature = vcfFeature(
    '1\t101\tins1\tA\tACGTACGTACGT\t60\tPASS\t.\tGT:PS\t1|.:77\t0|0:77',
    ['S1', 'S2'],
  )

  function run(featureColor?: () => string) {
    const result = computeVariantCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      referenceDrawingMode: 'draw',
      colorByPhaseSet: true,
      featureColor,
      ...genotypeArgs([feature]),
    })
    const byRow = new Map<number, { dosage: number; color: number }>()
    for (let i = 0; i < result.numCells; i++) {
      byRow.set(result.cellRowIndices[i]!, {
        dosage: result.cellAltDosage[i]!,
        color: result.cellColors[i]!,
      })
    }
    return byRow
  }

  test('a no-call haplotype under PS coloring carries no alt', () => {
    const byRow = run()
    expect(byRow.get(0)!.dosage).toBe(255) // S1 HP0 `1` — the insertion
    expect(byRow.get(1)!.dosage).toBe(0) // S1 HP1 `.` — no call
    expect(byRow.get(2)!.dosage).toBe(0) // S2 HP0 `0`
    expect(byRow.get(3)!.dosage).toBe(0) // S2 HP1 `0`
  })

  test('the per-variant override reaches the alt haplotype and nothing else', async () => {
    const { getCachedABGR } = await import('../../shared/variantWebglUtils.ts')
    const { NO_CALL_COLOR, REFERENCE_COLOR } =
      await import('../../shared/constants.ts')
    const override = 'rgb(1,2,3)'
    const byRow = run(() => override)
    expect(byRow.get(0)!.color).toBe(getCachedABGR(override))
    // a missing call must never be painted as though it carried the variant
    expect(byRow.get(1)!.color).toBe(getCachedABGR(NO_CALL_COLOR))
    expect(byRow.get(2)!.color).toBe(getCachedABGR(REFERENCE_COLOR))
  })
})

// The phase-set path resolves its style per cell rather than through the
// per-genotype memo, so `isRef` — which decides the paint-order bucket, not just
// a color — is classified there and nowhere else. Deleting that classification
// leaves every color right and paints reference cells on top of alt ones, which
// no color assertion can see.
test('phase-set coloring still files reference cells in the reference bucket', () => {
  const sources: ProcessedSource[] = [
    { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
    { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
    { name: 'S2 HP0', sampleName: 'S2', HP: 0 },
    { name: 'S2 HP1', sampleName: 'S2', HP: 1 },
  ]
  // S1 is het (one alt, one ref), S2 hom-ref: three reference cells, one alt.
  const feature = vcfFeature(
    '1\t101\tv1\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:77\t0|0:77',
    ['S1', 'S2'],
  )
  const result = computeVariantCells({
    filteredVariants: [{ feature, mostFrequentAlt: '1' }],
    sources,
    renderingMode: 'phased',
    referenceDrawingMode: 'draw',
    colorByPhaseSet: true,
    ...genotypeArgs([feature]),
  })
  expect(result.numCells).toBe(4)
  expect(result.refCellCount).toBe(3)
  // The one alt cell is S1 HP0, and it sits past the boundary so it paints last.
  expect([...result.cellRowIndices.slice(0, result.refCellCount)]).toEqual([
    1, 2, 3,
  ])
  expect(result.cellRowIndices[result.refCellCount]).toBe(0)
})

// `referenceDrawingMode: 'skip'` has to reach the phase-set path too, or the
// mode's whole point — grey background, only alt cells drawn — is lost the
// moment a user colors by phase set.
test('phase-set coloring honors referenceDrawingMode: skip', () => {
  const sources: ProcessedSource[] = [
    { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
    { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
  ]
  const feature = vcfFeature('1\t101\tv1\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:77', [
    'S1',
  ])
  const result = computeVariantCells({
    filteredVariants: [{ feature, mostFrequentAlt: '1' }],
    sources,
    renderingMode: 'phased',
    referenceDrawingMode: 'skip',
    colorByPhaseSet: true,
    ...genotypeArgs([feature]),
  })
  expect(result.numCells).toBe(1)
  expect(result.refCellCount).toBe(0)
  expect(result.cellRowIndices[0]).toBe(0)
})
