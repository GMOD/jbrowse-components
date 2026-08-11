import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import {
  covBottomOffsetPx,
  covEffectiveHeightPx,
} from './coverageBandLayout.generated.ts'

// Where the coverage bars live inside the band: the drawable height, and how
// far the baseline sits below the band's top edge. Every coverage mark on both
// backends measures from these two, and they are the shader's own — generated
// from alignmentsUniforms via coverage.slang (adr-051). The label inset is
// reserved at both ends, which is the whole reason the two differ.
//
// Its own module rather than a member of `rendererUtils.ts`, because the axis
// needs it too and `rendererUtils.ts` is downstream of `coverageDownsampling.ts`
// (where `computeCoverageTicks` lives). It is the coverage band's `axisPlotBox`:
// the drawing places its marks with it and the ticks place themselves with it,
// which is the only way a tick can be trusted to land on its own data.
export function coverageLayout(coverageHeight: number) {
  return {
    effectiveH: covEffectiveHeightPx(coverageHeight, YSCALEBAR_LABEL_OFFSET),
    bottom: covBottomOffsetPx(coverageHeight, YSCALEBAR_LABEL_OFFSET),
  }
}
