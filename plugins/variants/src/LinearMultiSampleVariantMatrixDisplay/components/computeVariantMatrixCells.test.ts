import VcfParser from '@gmod/vcf'

import VcfFeature from '../../VcfFeature/index.ts'
import {
  buildSampleIndex,
  decodeGenotype,
  internGenotype,
} from '../../shared/genotypeCodec.ts'
import { computeVariantMatrixCells } from './computeVariantMatrixCells.ts'

import type { ProcessedSource } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

// Phase-set coloring reads PS through `processFormatFields`, which only a real
// VcfFeature offers — see computeVariantCells.test.ts.
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

// See computeVariantCells.test.ts — the worker hands the compute pass the codes
// computeSampleInfo already interned, so the test builds the same shape.
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

describe('computeVariantMatrixCells phased genotypes', () => {
  // Two diploid samples, each split into two haplotype sources.
  const feature = makeFeature({
    genotypes: { S1: '1|0', S2: '1|1' },
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
    const args = genotypeArgs([feature])
    const result = computeVariantMatrixCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      ...args,
    })

    // Same as computeVariantCells: the codes are aligned to the sample order,
    // so the four HP-suffixed render rows share these two samples' calls.
    expect(decodeAll(result.featureData[0]!, args)).toEqual({
      S1: '1|0',
      S2: '1|1',
    })
    expect(args.sampleNames).toEqual(['S1', 'S2'])
  })
})

// Same two phased-mode rules computeVariantCells.test.ts pins, since both cell
// loops share getPhasedColor and the gate in front of it.
describe('computeVariantMatrixCells phased mode ploidy', () => {
  test('haploid calls color by allele, never the unphased fill', async () => {
    const { getCachedABGR } = await import('../../shared/variantWebglUtils.ts')
    const { BLACK_ABGR, PRIMARY_ALT_COLOR, REFERENCE_COLOR } =
      await import('../../shared/constants.ts')
    const feature = makeFeature({
      genotypes: { S1: '1|0', S2: '1', S3: '0' },
      FORMAT: [],
      ALT: ['A'],
      REF: 'G',
      name: 'v1',
      description: '',
      start: 100,
      end: 101,
    })
    const result = computeVariantMatrixCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources: [
        { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
        { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
        { name: 'S2 HP0', sampleName: 'S2', HP: 0 },
        { name: 'S3 HP0', sampleName: 'S3', HP: 0 },
      ],
      renderingMode: 'phased',
      ...genotypeArgs([feature]),
    })
    const byRow = new Map<number, number>()
    for (let i = 0; i < result.numCells; i++) {
      byRow.set(result.cellRowIndices[i]!, result.cellColors[i]!)
    }
    expect(byRow.get(2)).toBe(getCachedABGR(PRIMARY_ALT_COLOR)) // S2: 1
    expect(byRow.get(3)).toBe(getCachedABGR(REFERENCE_COLOR)) // S3: 0
    expect([...byRow.values()]).not.toContain(BLACK_ABGR)
  })

  test('a haplotype row the sample does not have draws no cell', () => {
    const feature = makeFeature({
      genotypes: { S1: '0|1|1', S2: '0|1' },
      FORMAT: [],
      ALT: ['A'],
      REF: 'G',
      name: 'v1',
      description: '',
      start: 100,
      end: 101,
    })
    const result = computeVariantMatrixCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources: ['S1', 'S2'].flatMap(s => [
        { name: `${s} HP0`, sampleName: s, HP: 0 },
        { name: `${s} HP1`, sampleName: s, HP: 1 },
        { name: `${s} HP2`, sampleName: s, HP: 2 },
      ]),
      renderingMode: 'phased',
      ...genotypeArgs([feature]),
    })
    const rows = [...result.cellRowIndices.slice(0, result.numCells)].sort()
    expect(rows).toEqual([0, 1, 2, 3, 4])
  })
})

// The cells are written from both ends of one buffer set — reference forward from
// 0, non-reference backward from the end — so the two paint buckets share an
// allocation. Two properties come out of that and the renderers rely on both:
// every reference cell precedes every non-reference one (alt paints over ref),
// and each bucket is still in feature-major / row-minor order after the backward
// half is flipped back. Read `numCells`, never `.length`: the buffers are only
// trimmed when genotypes were skipped.
describe('computeVariantMatrixCells cell bucket ordering', () => {
  const sources: ProcessedSource[] = [
    { name: 'S1', sampleName: 'S1' },
    { name: 'S2', sampleName: 'S2' },
    { name: 'S3', sampleName: 'S3' },
  ]

  function build(features: Feature[]) {
    const result = computeVariantMatrixCells({
      filteredVariants: features.map(feature => ({
        feature,
        mostFrequentAlt: '1',
      })),
      sources,
      renderingMode: 'alleleCount',
      ...genotypeArgs(features),
    })
    // reference cells are the grey ones; everything else carries an alt or a
    // no-call, which is exactly the ref/non-ref split addCell buckets on
    const keys = Array.from({ length: result.numCells }, (_, i) => ({
      feature: result.cellFeatureIndices[i]!,
      row: result.cellRowIndices[i]!,
    }))
    return { result, keys }
  }

  function isSortedFeatureMajor(keys: { feature: number; row: number }[]) {
    return keys.every(
      (k, i) =>
        i === 0 ||
        k.feature > keys[i - 1]!.feature ||
        (k.feature === keys[i - 1]!.feature && k.row > keys[i - 1]!.row),
    )
  }

  // Every sample genotyped at every site, so the buffers are never trimmed and
  // the two cursors meet exactly.
  it('partitions a dense matrix without trimming', () => {
    const features = [
      makeFeature({ genotypes: { S1: '0/0', S2: '0/1', S3: '1/1' } }, 'v1'),
      makeFeature({ genotypes: { S1: '0/1', S2: '0/0', S3: '0/0' } }, 'v2'),
    ]
    const { result, keys } = build(features)
    expect(result.numCells).toBe(6)
    expect(result.cellFeatureIndices).toHaveLength(6)

    // the 3 hom-ref cells lead, then the 3 alt-carrying ones, each bucket in
    // feature-major / row-minor order
    const refCount = 3
    expect(keys.slice(0, refCount)).toEqual([
      { feature: 0, row: 0 },
      { feature: 1, row: 1 },
      { feature: 1, row: 2 },
    ])
    expect(keys.slice(refCount)).toEqual([
      { feature: 0, row: 1 },
      { feature: 0, row: 2 },
      { feature: 1, row: 0 },
    ])
    expect(isSortedFeatureMajor(keys.slice(0, refCount))).toBe(true)
    expect(isSortedFeatureMajor(keys.slice(refCount))).toBe(true)
  })

  // Ungenotyped samples leave a gap between the two write cursors, which has to
  // be closed and the buffers trimmed.
  it('closes the gap and trims when genotypes are missing', () => {
    const features = [
      makeFeature({ genotypes: { S1: '0/0', S3: '1/1' } }, 'v1'),
      makeFeature({ genotypes: { S2: '0/1' } }, 'v2'),
    ]
    const { result, keys } = build(features)
    expect(result.numCells).toBe(3)
    expect(result.cellFeatureIndices).toHaveLength(3)
    expect(keys).toEqual([
      // the one hom-ref cell
      { feature: 0, row: 0 },
      // then the alt-carrying ones, feature-major
      { feature: 0, row: 2 },
      { feature: 1, row: 1 },
    ])
  })
})

// A monomorphic record spells its ALT column '.', which @gmod/vcf parses to
// `undefined`. The matrix always draws reference cells, so such a site is always
// hoverable and `VariantFeatureInfo.alt` has to hold `[]` — the tooltip and the
// feature widget read `.alt` unguarded.
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
  const result = computeVariantMatrixCells({
    filteredVariants: [{ feature, mostFrequentAlt: '1' }],
    sources: [{ name: 'S1', sampleName: 'S1' }],
    renderingMode: 'alleleCount',
    ...genotypeArgs([feature]),
  })
  expect(result.numCells).toBe(1)
  expect(result.featureData[0]!.alt).toEqual([])
})

// The matrix's phase-set branch shares `makePhaseSetStyler` with the regular
// display's, and had no coverage of its own before that extraction — so a change
// to the shared classification could break exactly one of the two displays in
// silence. `isRef` is the half no color assertion can see: it files the cell in
// the reference bucket, which is what makes alt paint over ref.
describe('phase-set coloring', () => {
  const sources: ProcessedSource[] = [
    { name: 'S1 HP0', sampleName: 'S1', HP: 0 },
    { name: 'S1 HP1', sampleName: 'S1', HP: 1 },
    { name: 'S2 HP0', sampleName: 'S2', HP: 0 },
    { name: 'S2 HP1', sampleName: 'S2', HP: 1 },
  ]
  // S1 het (one alt, one ref), S2 hom-ref: three reference cells, one alt.
  const feature = vcfFeature(
    '1\t101\tv1\tG\tA\t60\tPASS\t.\tGT:PS\t1|0:77\t0|0:77',
    ['S1', 'S2'],
  )

  const run = (colorByPhaseSet: boolean) =>
    computeVariantMatrixCells({
      filteredVariants: [{ feature, mostFrequentAlt: '1' }],
      sources,
      renderingMode: 'phased',
      colorByPhaseSet,
      ...genotypeArgs([feature]),
    })

  test('files reference cells in the reference bucket', () => {
    const result = run(true)
    expect(result.numCells).toBe(4)
    // ref bucket first, in row order; the single alt cell is S1 HP0 and paints
    // last
    expect([...result.cellRowIndices.slice(0, result.numCells)]).toEqual([
      1, 2, 3, 0,
    ])
  })

  test('the alt cell takes its hue from PS, not from the allele', async () => {
    const { getCachedABGR } = await import('../../shared/variantWebglUtils.ts')
    const { PRIMARY_ALT_COLOR } = await import('../../shared/constants.ts')
    const primary = getCachedABGR(PRIMARY_ALT_COLOR)
    expect(run(false).cellColors[3]).toBe(primary)
    expect(run(true).cellColors[3]).not.toBe(primary)
  })
})
