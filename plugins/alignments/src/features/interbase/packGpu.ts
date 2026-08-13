import { slangPass } from '@jbrowse/render-core/slangPass'

import * as interbaseShader from '../../shaders/slang/interbaseHistogram.generated.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

// `interbaseCov*` / `interbasePackedBuffer` are the coverage-area arrays; the
// plain `interbase*` ones on CigarUploadData are the row-instanced marks, a
// different pass.
export const INTERBASE_PASS = {
  ...slangPass({
    id: 'interbase',
    mod: interbaseShader,
  }),
  pack: (data: Pick<CoverageUploadData, 'interbasePackedBuffer'>) =>
    data.interbasePackedBuffer,
}

export { packInterbaseSegmentsForGpu } from '@jbrowse/alignments-core'
