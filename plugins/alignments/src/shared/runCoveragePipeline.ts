import {
  computeCoverage,
  computeInterbaseCoverage,
  computeSNPCoverage,
} from '@jbrowse/alignments-core'
import { updateStatus } from '@jbrowse/core/util'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { buildModTooltipData } from './buildTooltipData.ts'
import { computeFrequenciesAndThresholds } from './computeFrequenciesAndThresholds.ts'
import { packCoverageAreaForGpu } from './packCoverageArea.ts'
import { computeModificationCoverage } from '../features/modCoverage/compute.ts'
import { computeSashimiJunctions } from '../features/sashimi/compute.ts'

import type { StrandBaseCounts } from './calculateModificationCounts.ts'
import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

/**
 * Runs the full coverage-area computation pipeline as a single named operation.
 * Both pileup and chain executors call this so that the coverage step order
 * (compute → freqs → SNP → interbase → mod → mod-tooltip → sashimi → pack) cannot
 * drift between them.
 *
 * Mod coverage runs whenever `trackStrands` is set (the modification color
 * modes); chain mode leaves it off so `packCoverageAreaForGpu` emits a 0-byte
 * mod-cov pass. Its modifiable/detectable denominator comes from a read-base
 * pileup (`modBaseCounts`, IGV-style), so no reference sequence is needed here.
 */
export async function runCoveragePipeline({
  features,
  gaps,
  mismatches,
  insertions,
  softclips,
  hardclips,
  modifications,
  modBaseCounts,
  simplexModifications,
  region,
  mismatchArrays,
  interbaseArrays,
  gapArrays,
  trackStrands,
  statusCallback,
  stopTokenCheck,
}: {
  features: FeatureData[]
  gaps: GapData[]
  mismatches: MismatchData[]
  insertions: InsertionData[]
  softclips: SoftclipData[]
  hardclips: HardclipData[]
  modifications: ModificationEntry[]
  modBaseCounts: ReadonlyMap<number, StrandBaseCounts>
  simplexModifications: ReadonlySet<string>
  region: Region
  mismatchArrays: Parameters<typeof computeFrequenciesAndThresholds>[0]
  interbaseArrays: Parameters<typeof computeFrequenciesAndThresholds>[1]
  gapArrays: Parameters<typeof computeFrequenciesAndThresholds>[2]
  trackStrands?: boolean
  statusCallback: StatusCallback
  stopTokenCheck: StopTokenChecker
}) {
  const { start: regionStart, end: regionEnd } = region
  // Total depth only — mod coverage now derives its per-strand denominator from
  // read bases (modBaseCounts), so the old per-strand depth sweep is unused.
  const coverage = await updateStatus(
    'Computing coverage',
    statusCallback,
    async () => computeCoverage(features, gaps, regionStart, regionEnd),
  )

  checkStopToken2(stopTokenCheck)

  const { mismatchFrequencies, interbaseFrequencies, gapFrequencies } =
    computeFrequenciesAndThresholds(
      mismatchArrays,
      interbaseArrays,
      gapArrays,
      coverage.depths,
      coverage.startPos,
    )

  const snpCoverage = computeSNPCoverage(mismatches, regionStart, coverage)
  const interbaseCoverage = computeInterbaseCoverage(
    insertions,
    softclips,
    hardclips,
    regionStart,
    coverage,
  )

  const modCoverage = trackStrands
    ? computeModificationCoverage(
        modifications,
        modBaseCounts,
        regionStart,
        coverage,
        simplexModifications,
      )
    : undefined

  const modTooltipData = buildModTooltipData({ modifications, regionStart })
  const sashimi = computeSashimiJunctions(gaps)

  const coverageAreaPacked = packCoverageAreaForGpu(
    coverage,
    snpCoverage,
    interbaseCoverage,
    modCoverage,
  )

  return {
    coverage,
    snpCoverage,
    interbaseCoverage,
    modCoverage,
    modTooltipData,
    sashimi,
    coverageAreaPacked,
    mismatchFrequencies,
    interbaseFrequencies,
    gapFrequencies,
  }
}
