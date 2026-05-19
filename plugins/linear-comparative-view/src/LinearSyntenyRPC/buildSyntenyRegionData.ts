import {
  computeInsertionIndicators,
  computeSNPCoverage,
  extractIndelsFromCs,
  extractMismatchesFromCs,
} from '@jbrowse/alignments-core'
import { computeCoverage } from '@jbrowse/plugin-alignments'

import type { SyntenyRegionData } from './syntenyRegionTypes.ts'
import type { IndelEntry, MismatchEntry } from '@jbrowse/alignments-core'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export function buildSyntenyRegionData(
  region: { start: number; end: number; refName: string },
  genomeFeatures: [string, MultiPairFeature[]][],
): SyntenyRegionData {
  const regionStart = Math.floor(region.start)
  const regionEnd = Math.ceil(region.end)

  const coverageFeatures: { start: number; end: number }[] = []
  const mismatches: MismatchEntry[] = []
  const indels: IndelEntry[] = []
  for (const [, features] of genomeFeatures) {
    for (const f of features) {
      coverageFeatures.push({ start: f.start, end: f.end })
      if (f.cs) {
        extractMismatchesFromCs(f.cs, f.start, mismatches)
        extractIndelsFromCs(f.cs, f.start, indels)
      }
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
    refName: region.refName,
    regionStart,
    genomeFeatures,
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
