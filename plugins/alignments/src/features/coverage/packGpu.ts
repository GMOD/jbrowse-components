import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as coverageShader from '../../shaders/slang/coverage.generated.ts'

export const PASS_COVERAGE = 'coverage'

export const COVERAGE_PASS = slangPass({
  id: PASS_COVERAGE,
  mod: coverageShader,
})

// Coverage depth bins are pre-packed in the worker (see
// shared/runCoveragePipeline + alignments-core's packCoverageBinsForGpu).
// Main-thread upload writes the buffer directly via writeBuffer — no repack.
