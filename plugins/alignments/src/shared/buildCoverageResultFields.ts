import type { runCoveragePipeline } from './runCoveragePipeline.ts'

// Flattens the coverage-pipeline result into the per-region fields the main
// thread reads (coverageDepths, snpPositions, etc.). Single owner of the
// flat-field naming so the worker contract stays in one place.
export function buildCoverageResultFields(
  pipeline: Awaited<ReturnType<typeof runCoveragePipeline>>,
) {
  const {
    coverage,
    snpCoverage,
    noncovCoverage,
    modCoverage,
    coverageAreaPacked,
    sashimi,
    modTooltipData,
  } = pipeline

  // Empty TypedArrays must be allocated per-call: collectResultTransferables
  // adds their underlying ArrayBuffer to the worker's transfer list, which
  // detaches it. Sharing a module-level singleton causes DataCloneError on
  // the second RPC reply.
  return {
    coverageDepths: coverage.depths,
    coverageMaxDepth: coverage.maxDepth,
    coverageStartPos: coverage.startPos,

    snpPositions: snpCoverage.positions,
    snpYOffsets: snpCoverage.yOffsets,
    snpHeights: snpCoverage.heights,
    snpColorTypes: snpCoverage.colorTypes,

    noncovPositions: noncovCoverage.positions,
    noncovYOffsets: noncovCoverage.yOffsets,
    noncovHeights: noncovCoverage.heights,
    noncovColorTypes: noncovCoverage.colorTypes,
    noncovMaxCount: noncovCoverage.maxCount,

    indicatorPositions: noncovCoverage.indicatorPositions,
    indicatorColorTypes: noncovCoverage.indicatorColorTypes,

    modCovPositions: modCoverage?.positions ?? new Uint32Array(0),
    modCovYOffsets: modCoverage?.yOffsets ?? new Float32Array(0),
    modCovHeights: modCoverage?.heights ?? new Float32Array(0),
    modCovColors: modCoverage?.colors ?? new Uint32Array(0),

    ...coverageAreaPacked,
    ...sashimi,
    modTooltipData,
  }
}
