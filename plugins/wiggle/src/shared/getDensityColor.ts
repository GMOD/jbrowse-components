import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'
import { rampMidNorm } from '@jbrowse/render-core/scoreScale'
import { rampMidT } from '@jbrowse/render-core/shaders/colorRampLut'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'

// A gradient's Canvas2D fill: the normalizer the shader shares, then
// colorRampLut.slang's `rampMidT` into the same
// 256-entry ramp bytes the GPU samples as the density pass's texture —
// `makeRampFillStyleLut` is the fillStyle LUT HiC's and LD's Canvas2D twins
// already index the same way. densityColorParity.test.ts sweeps the two
// backends onto one LUT bucket.
export function makeDensityLutFillFn(
  domainMin: number,
  domainMax: number,
  scaleType: ScaleTypeCode,
  ramp: Uint8Array,
  rampMid: number | undefined,
  symlogConstant = 1,
) {
  const normalize = makeScoreNormalizer(
    domainMin,
    domainMax,
    scaleType,
    symlogConstant,
  )
  const midNorm = rampMidNorm(
    domainMin,
    domainMax,
    scaleType,
    rampMid,
    symlogConstant,
  )
  const fill = makeRampFillStyleLut(ramp)
  return (score: number) => fill(rampMidT(normalize(score), midNorm))
}
