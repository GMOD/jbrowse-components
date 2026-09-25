import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  BASE_QUALITY_RAMP_MAX,
  qualityRampAbgr,
} from '../../shared/qualityRamps.ts'

// A BAM record with no QUAL has no scores at all; a CRAM one decodes as 255 at
// every base. It packs as 0, which `packedColorQuad.slang` paints as the plain
// read fill, so it follows the theme and the read colour setting.
export const BASE_QUALITY_UNAVAILABLE = 255

export const qualityAbgr = qualityRampAbgr(BASE_QUALITY_RAMP_MAX)
qualityAbgr[BASE_QUALITY_UNAVAILABLE] = 0

export const qualityRampCss = Array.from(qualityAbgr, abgrToCssRgba)

let lastPlainReadCss = ''
let lastPaintCss = qualityRampCss

/** The CSS each score paints, a missing one in the plain read fill. */
export function qualityPaintCss(plainReadCss: string) {
  if (plainReadCss !== lastPlainReadCss) {
    lastPaintCss = [...qualityRampCss]
    lastPaintCss[BASE_QUALITY_UNAVAILABLE] = plainReadCss
    lastPlainReadCss = plainReadCss
  }
  return lastPaintCss
}
