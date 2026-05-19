import {
  computeInsertionIndicators,
  computeSNPCoverage,
  extractIndelsFromCs,
  extractMismatchesFromCs,
} from '@jbrowse/alignments-core'
import { computeCoverage } from '@jbrowse/plugin-alignments'

import type { SyntenyRegionData } from '../../LinearSyntenyRPC/syntenyRegionTypes.ts'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export function feat(
  overrides: Partial<MultiPairFeature> = {},
): MultiPairFeature {
  return {
    queryGenome: 'genomeA',
    origRefName: 'chr1',
    start: 100,
    end: 200,
    mateStart: 0,
    mateEnd: 100,
    mateRefName: 'chr1',
    strand: 1,
    syriType: undefined,
    identity: 0.99,
    featureId: 'f1',
    segmentId: undefined,
    cigar: undefined,
    cs: undefined,
    ...overrides,
  }
}

export function buildRegionData(
  region: { start: number; end: number; refName?: string },
  features: MultiPairFeature[],
): SyntenyRegionData {
  const regionStart = Math.floor(region.start)
  const regionEnd = Math.ceil(region.end)
  const coverageFeatures = features.map(f => ({ start: f.start, end: f.end }))
  const mismatches: { position: number; base: number; strand: number }[] = []
  const indels: { position: number; type: 1 | 2; length: number }[] = []
  for (const f of features) {
    if (f.cs) {
      extractMismatchesFromCs(f.cs, f.start, mismatches)
      extractIndelsFromCs(f.cs, f.start, indels)
    }
  }
  const coverage = computeCoverage(coverageFeatures, [], regionStart, regionEnd)
  const snp = computeSNPCoverage(mismatches, regionStart, coverage)
  const indicators = computeInsertionIndicators(
    indels,
    coverage.depths,
    coverage.startPos,
  )
  const mismatchPositions = new Uint32Array(mismatches.length)
  const mismatchBases = new Uint8Array(mismatches.length)
  for (let i = 0; i < mismatches.length; i++) {
    mismatchPositions[i] = mismatches[i]!.position - regionStart
    mismatchBases[i] = mismatches[i]!.base
  }
  return {
    refName: region.refName ?? 'chr1',
    regionStart,
    genomeFeatures: [['genomeA', features]],
    coverageDepths: coverage.depths,
    coverageMaxDepth: coverage.maxDepth,
    coverageStartPos: coverage.startPos,
    snpPositions: snp.positions,
    snpYOffsets: snp.yOffsets,
    snpHeights: snp.heights,
    snpColorTypes: snp.colorTypes,
    snpRelDepths: snp.relDepths,
    snpCount: snp.count,
    mismatchPositions,
    mismatchBases,
    numMismatches: mismatches.length,
    indicatorPositions: indicators.positions,
    numIndicators: indicators.count,
  }
}
