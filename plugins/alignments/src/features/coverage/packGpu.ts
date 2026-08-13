import { instancePass } from '@jbrowse/render-core/instancePass'
import * as coverageShader from '../../shaders/slang/coverage.generated.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

export const PASS_COVERAGE = 'coverage'

// Coverage depth bins are pre-packed in the worker (see
// shared/runCoveragePipeline + alignments-core's packCoverageBinsForGpu), so
// this pass's "packer" is the field the worker filled — uploaded verbatim, no
// repack. `coverageGpuBinCount` is that buffer's record count said a second
// time, for the region metadata that has no buffer to ask; the upload asks the
// buffer.
export const COVERAGE_PASS = instancePass({
  id: PASS_COVERAGE,
  mod: coverageShader,
  pack: (data: Pick<CoverageUploadData, 'coveragePackedBuffer'>) =>
    data.coveragePackedBuffer,
})
