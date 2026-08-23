import { COVERAGE_BAR_PASS } from '@jbrowse/render-core/coverageBand'

// The coverage band's five passes are render-core's — the MAF display draws the
// same shaders off the same layouts (see coverageBand.slang), so the pass, its
// shader and its packer live where both plugins can reach them. This file stays
// as the `features/coverage` entry point the pass-per-directory convention reads
// as the pass list, and because `COVERAGE_PASS` is the name the renderer's
// `GPU_COVERAGE_PASS` registry maps a layer id to.
//
// Depth bins are pre-packed in the worker (shared/runCoveragePipeline +
// alignments-core's packCoverageBinsForGpu), so the shared pass's "packer" is
// the field the worker filled, uploaded verbatim.
export const COVERAGE_PASS = COVERAGE_BAR_PASS
