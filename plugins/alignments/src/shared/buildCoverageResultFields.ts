import { downsampleStatsBins } from '@jbrowse/alignments-core'

import type { runCoveragePipeline } from './runCoveragePipeline.ts'

// Coarse-stats bin cap. Below this the per-bp depth array is shipped without a
// stats-bin sidecar and the main thread scans it directly; above it (whole-
// chromosome scale) the sidecar lets the main-thread autoscale reduce run over
// ~64k bins instead of tens of millions of bp. Independent of the GPU depth-bar
// cap (packCoverageArea) — these bins never reach the GPU.
const MAX_COVERAGE_STATS_BINS = 65536

// Flattens the coverage-pipeline result into the per-region fields the main
// thread reads (coverageDepths, the packed segment buffers, the stats sidecar).
// Single owner of the flat-field naming so the worker contract stays in one
// place.
//
// The four segment layers — SNP, interbase histogram, indicators, modification
// coverage — ship ONLY as their packed instance buffers. They used to ship as
// parallel typed arrays as well, sixteen of them, on the reading that the
// buffers were "for the GPU" and the arrays "for everything else". Nothing else
// read them: the Canvas2D draw, the SVG export and the interbase hit test all
// go through the same buffers, so those arrays were 45-100% of each layer's
// payload cloned and retained per region per group for no reader. What the
// tooltip and the hit test genuinely need per-bp — `coverageDepths` and the
// per-event `interbase*`/`mismatch*` arrays — is a different thing and is still
// here.
export function buildCoverageResultFields(
  pipeline: Awaited<ReturnType<typeof runCoveragePipeline>>,
) {
  const {
    coverage,
    interbaseMaxCount,
    coverageAreaPacked,
    sashimi,
    modTooltip,
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

    // The denominator the interbase stack fractions were baked against; see
    // `interbaseBarHeightPx`. Not derivable from the buffer, so it travels
    // beside it.
    interbaseMaxCount,

    ...coverageAreaPacked,
    ...sashimi,
    // Spread flat: `collectGroupedTransferables` walks the result's own values,
    // so a typed array nested one level down would be structured-cloned instead
    // of transferred — silently, and this is the field that shape was built to
    // stop copying.
    ...modTooltip,
  }
}
