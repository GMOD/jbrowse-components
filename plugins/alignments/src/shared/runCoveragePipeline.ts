import { updateStatus } from '@jbrowse/core/util'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { buildModTooltipData } from './buildTooltipData.ts'
import { computeFrequenciesAndThresholds } from './computeFrequenciesAndThresholds.ts'
import { packCoverageAreaForGpu } from './packCoverageArea.ts'
import { computeCoverage } from '../features/coverage/compute.ts'
import { computeModificationCoverage } from '../features/modCoverage/compute.ts'
import { computeNoncovCoverage } from '../features/noncov/compute.ts'
import { computeSashimiJunctions } from '../features/sashimi/compute.ts'
import { computeSNPCoverage } from '../features/snpCoverage/compute.ts'

import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
  SoftclipData,
} from './webglRpcTypes.ts'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

/**
 * Runs the full coverage-area computation pipeline as a single named operation.
 * Both pileup and chain executors call this so that the coverage step order
 * (compute → freqs → SNP → noncov → mod → mod-tooltip → sashimi → pack) cannot
 * drift between them.
 *
 * Pileup passes `regionSequence` to enable mod coverage; chain omits it so the
 * mod-coverage step is skipped and `packCoverageAreaForGpu` emits a 0-byte
 * mod-cov pass.
 */
export async function runCoveragePipeline({
  features,
  gaps,
  mismatches,
  insertions,
  softclips,
  hardclips,
  modifications,
  regionStart,
  regionEnd,
  mismatchArrays,
  interbaseArrays,
  gapArrays,
  trackStrands,
  regionSequence,
  regionSequenceStart,
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
  regionStart: number
  regionEnd: number
  mismatchArrays: Parameters<typeof computeFrequenciesAndThresholds>[0]
  interbaseArrays: Parameters<typeof computeFrequenciesAndThresholds>[1]
  gapArrays: Parameters<typeof computeFrequenciesAndThresholds>[2]
  trackStrands?: boolean
  regionSequence?: string
  regionSequenceStart?: number
  statusCallback: (s: string) => void
  stopTokenCheck: StopTokenChecker
}) {
  const coverage = await updateStatus(
    'Computing coverage',
    statusCallback,
    async () =>
      computeCoverage(features, gaps, regionStart, regionEnd, trackStrands),
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
  const noncovCoverage = computeNoncovCoverage(
    insertions,
    softclips,
    hardclips,
    regionStart,
    coverage,
  )

  const modCoverage =
    regionSequence !== undefined
      ? computeModificationCoverage(
          modifications,
          mismatches,
          regionStart,
          coverage,
          regionSequence,
          regionSequenceStart ?? regionStart,
        )
      : undefined

  const modTooltipData = buildModTooltipData({ modifications, regionStart })
  const sashimi = computeSashimiJunctions(gaps)

  const coverageAreaPacked = packCoverageAreaForGpu(
    coverage,
    snpCoverage,
    noncovCoverage,
    modCoverage,
  )

  return {
    coverage,
    snpCoverage,
    noncovCoverage,
    modCoverage,
    modTooltipData,
    sashimi,
    coverageAreaPacked,
    mismatchFrequencies,
    interbaseFrequencies,
    gapFrequencies,
  }
}
