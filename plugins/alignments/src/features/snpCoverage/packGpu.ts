import { slangPass } from '@jbrowse/render-core/slangPass'

import * as snpCoverageShader from '../../shaders/slang/snpCoverage.generated.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

// Written worker-side by `computeSNPCoverage`, which fills this layout directly
// rather than building parallel arrays to pack from, and uploaded verbatim.
export const SNP_COVERAGE_PASS = {
  ...slangPass({
    id: 'snpCov',
    mod: snpCoverageShader,
  }),
  pack: (data: Pick<CoverageUploadData, 'snpPackedBuffer'>) =>
    data.snpPackedBuffer,
}
