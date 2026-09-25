import { colorPairLR } from '@jbrowse/core/ui/palette'
import { abgrToCssRgba, cssColorToABGR } from '@jbrowse/core/util/colorBits'

import {
  BASE_QUALITY_RAMP_MAX,
  qualityRampAbgr,
} from '../../shared/qualityRamps.ts'

// A BAM record with no QUAL has no scores at all; a CRAM one decodes as 255 at
// every base.
export const BASE_QUALITY_UNAVAILABLE = 255

export const BASE_QUALITY_UNAVAILABLE_COLOR = colorPairLR

export const qualityAbgr = qualityRampAbgr(BASE_QUALITY_RAMP_MAX)
qualityAbgr[BASE_QUALITY_UNAVAILABLE] = cssColorToABGR(
  BASE_QUALITY_UNAVAILABLE_COLOR,
)

export const qualityCssColors = Array.from(qualityAbgr, abgrToCssRgba)
