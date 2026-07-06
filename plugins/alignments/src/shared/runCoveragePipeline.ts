import {
  computeCoverage,
  computeInterbaseCoverage,
  computeSNPCoverage,
} from '@jbrowse/alignments-core'
import { updateStatus } from '@jbrowse/core/util'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { perfTimeSync } from './alignmentsPerf.ts'
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
  showCoverage,
  trackStrands,
  statusCallback,
  stopTokenCheck,
}: {
  features: FeatureData[]
  gaps: GapData[]
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
  showCoverage: boolean
  trackStrands?: boolean
  statusCallback: StatusCallback
  stopTokenCheck: StopTokenChecker
}) {
  const { start: regionStart, end: regionEnd } = region
  // The per-strand depth sweep (fwd/revDepths) backs the coverage tooltip's
  // strand breakdown, which only exists when the band is drawn — so it runs
  // only when showCoverage is on (each sweep is a full pass over every read).
  const coverage = await updateStatus(
    'Computing coverage',
    statusCallback,
    async () =>
      perfTimeSync('    computeCoverage', () =>
        computeCoverage(features, gaps, regionStart, regionEnd, showCoverage),
      ),
  )

  checkStopToken2(stopTokenCheck)

  // Frequencies read the full per-bp depth sweep at each event position and feed
  // the pileup's low-frequency mismatch/indel fade. They are computed BEFORE the
  // band gate below, so the fade is identical whether or not the coverage band
  // is shown — do not couple it to showCoverage.
  const { mismatchFrequencies, interbaseFrequencies, gapFrequencies } =
    perfTimeSync('    computeFrequenciesAndThresholds', () =>
      computeFrequenciesAndThresholds(
        mismatchArrays,
        interbaseArrays,
        gapArrays,
        coverage.depths,
        coverage.startPos,
      ),
    )

  // The coverage band — histogram, SNP/interbase/mod segments, sashimi arcs, and
  // the per-bp GPU depth buffer — only renders when showCoverage is on (the
  // LGVSyntenyDisplay default is off). The per-bp buffer alone is regionWidth×8
  // bytes and overflows the GPU device limit at whole-chromosome scale, so when
  // the band is off we skip every band computation and return an empty coverage
  // depth array; uploadCoverage / buildCoverageFields / coverageStats all no-op
  // on a zero-length depth array.
  const band = showCoverage
    ? computeCoverageBand({
        coverage,
        mismatchArrays,
        insertions,
        softclips,
        hardclips,
        gaps,
        modifications,
        modBaseCounts,
        simplexModifications,
        regionStart,
        trackStrands,
      })
    : emptyCoverageBand()

  return {
    coverage: showCoverage
      ? coverage
      : {
          depths: new Float32Array(0),
          fwdDepths: undefined,
          revDepths: undefined,
          maxDepth: 0,
          binSize: coverage.binSize,
          startPos: coverage.startPos,
        },
    ...band,
    mismatchFrequencies,
    interbaseFrequencies,
    gapFrequencies,
  }
}

// The position-aggregate coverage-band passes: SNP/interbase/mod segments,
// sashimi arcs, the mod tooltip, and the packed GPU buffers. Split out so the
// showCoverage gate in runCoveragePipeline reads as one branch rather than
// interleaving with the always-run frequency computation.
function computeCoverageBand({
  coverage,
  mismatchArrays,
  insertions,
  softclips,
  hardclips,
  gaps,
  modifications,
  modBaseCounts,
  simplexModifications,
  regionStart,
  trackStrands,
}: {
  coverage: ReturnType<typeof computeCoverage>
  mismatchArrays: Parameters<typeof computeFrequenciesAndThresholds>[0]
  insertions: InsertionData[]
  softclips: SoftclipData[]
  hardclips: HardclipData[]
  gaps: GapData[]
  modifications: ModificationEntry[]
  modBaseCounts: ReadonlyMap<number, StrandBaseCounts>
  simplexModifications: ReadonlySet<string>
  regionStart: number
  trackStrands?: boolean
}) {
  const snpCoverage = computeSNPCoverage(
    mismatchArrays.mismatchPositions,
    mismatchArrays.mismatchBases,
    coverage,
  )
  const interbaseCoverage = perfTimeSync('    computeInterbaseCoverage', () =>
    computeInterbaseCoverage(
      insertions,
      softclips,
      hardclips,
      regionStart,
      coverage,
    ),
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

  const coverageAreaPacked = perfTimeSync('    packCoverageAreaForGpu', () =>
    packCoverageAreaForGpu(coverage, snpCoverage, interbaseCoverage, modCoverage),
  )

  return {
    snpCoverage,
    interbaseCoverage,
    modCoverage,
    modTooltipData,
    sashimi,
    coverageAreaPacked,
  }
}

// Zero-length equivalents of every band field, shaped to match
// computeCoverageBand so buildCoverageResultFields spreads identical field
// names whether or not the band ran. Empty TypedArrays/ArrayBuffers are
// allocated per call (collectGroupedTransferables detaches them on transfer).
function emptyCoverageBand(): ReturnType<typeof computeCoverageBand> {
  return {
    snpCoverage: {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colorTypes: new Uint8Array(0),
      relDepths: new Float32Array(0),
      count: 0,
    },
    interbaseCoverage: {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colorTypes: new Uint8Array(0),
      indicatorPositions: new Uint32Array(0),
      indicatorColorTypes: new Uint8Array(0),
      maxCount: 0,
      segmentCount: 0,
      indicatorCount: 0,
    },
    modCoverage: undefined,
    modTooltipData: {},
    sashimi: {
      sashimiX1: new Uint32Array(0),
      sashimiX2: new Uint32Array(0),
      sashimiColorTypes: new Uint8Array(0),
      sashimiCounts: new Uint32Array(0),
    },
    coverageAreaPacked: {
      coveragePackedBuffer: new ArrayBuffer(0),
      snpPackedBuffer: new ArrayBuffer(0),
      interbasePackedBuffer: new ArrayBuffer(0),
      indicatorPackedBuffer: new ArrayBuffer(0),
      modCovPackedBuffer: new ArrayBuffer(0),
    },
  }
}
