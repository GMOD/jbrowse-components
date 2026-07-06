import { downsampleStatsBins } from '@jbrowse/alignments-core'

import type { runCoveragePipeline } from './runCoveragePipeline.ts'

// Coarse-stats bin cap. Below this the per-bp depth array is shipped without a
// stats-bin sidecar and the main thread scans it directly; above it (whole-
// chromosome scale) the sidecar lets the main-thread autoscale reduce run over
// ~64k bins instead of tens of millions of bp. Independent of the GPU depth-bar
// cap (packCoverageArea) — these bins never reach the GPU.
const MAX_COVERAGE_STATS_BINS = 65536

// Flattens the coverage-pipeline result into the per-region fields the main
// thread reads (coverageDepths, snpPositions, etc.). Single owner of the
// flat-field naming so the worker contract stays in one place.
export function buildCoverageResultFields(
  pipeline: Awaited<ReturnType<typeof runCoveragePipeline>>,
) {
  const {
    coverage,
    snpCoverage,
    interbaseCoverage,
    modCoverage,
    coverageAreaPacked,
    sashimi,
    modTooltipData,
  } = pipeline

  // Coarse per-bin stats sidecar; empty (binSize 1) below the cap, so the main
  // thread falls back to a per-bp scan there (see downsampleStatsBins).
  const statsBins = downsampleStatsBins(
    coverage.depths,
    MAX_COVERAGE_STATS_BINS,
  )

  // Empty TypedArrays must be allocated per-call: collectGroupedTransferables
  // adds their underlying ArrayBuffer to the worker's transfer list, which
  // detaches it. Sharing a module-level singleton causes DataCloneError on
  // the second RPC reply.
  return {
    coverageDepths: coverage.depths,
    coverageFwdDepths: coverage.fwdDepths ?? new Float32Array(0),
    coverageRevDepths: coverage.revDepths ?? new Float32Array(0),
    coverageMaxDepth: coverage.maxDepth,
    coverageStartPos: coverage.startPos,
    coverageStatsBinSize: statsBins.binSize,
    coverageStatsMins: statsBins.mins,
    coverageStatsMaxs: statsBins.maxs,
    coverageStatsSums: statsBins.sums,
    coverageStatsSumSqs: statsBins.sumSqs,

    snpPositions: snpCoverage.positions,
    snpYOffsets: snpCoverage.yOffsets,
    snpHeights: snpCoverage.heights,
    snpColorTypes: snpCoverage.colorTypes,
    snpRelDepths: snpCoverage.relDepths,

    interbaseCovPositions: interbaseCoverage.positions,
    interbaseCovYOffsets: interbaseCoverage.yOffsets,
    interbaseCovHeights: interbaseCoverage.heights,
    interbaseCovColorTypes: interbaseCoverage.colorTypes,
    interbaseMaxCount: interbaseCoverage.maxCount,

    indicatorPositions: interbaseCoverage.indicatorPositions,
    indicatorColorTypes: interbaseCoverage.indicatorColorTypes,

    modCovPositions: modCoverage?.positions ?? new Uint32Array(0),
    modCovYOffsets: modCoverage?.yOffsets ?? new Float32Array(0),
    modCovHeights: modCoverage?.heights ?? new Float32Array(0),
    modCovColors: modCoverage?.colors ?? new Uint32Array(0),
    modCovRelDepths: modCoverage?.relDepths ?? new Float32Array(0),

    ...coverageAreaPacked,
    ...sashimi,
    modTooltipData,
  }
}
