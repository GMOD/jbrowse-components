import { slangPass } from '@jbrowse/render-core/slangPass'

import * as indicatorShader from '../../shaders/slang/indicator.generated.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

export const INDICATOR_PASS = {
  ...slangPass({
    id: 'indicator',
    mod: indicatorShader,
  }),
  pack: (data: Pick<CoverageUploadData, 'indicatorPackedBuffer'>) =>
    data.indicatorPackedBuffer,
}
