import { scaleTypeCode } from '../scoreScale.ts'

import type { MarkValueScaleType } from './types.ts'

/** The y scale a valued shape places its instances through. */
export interface MarkValueScale {
  /** `[min, max]` the values are read through. */
  domain: [number, number]
  /** How that domain is read; linear when absent. */
  scaleType?: MarkValueScaleType
  /**
   * symlog's linear-region width, already resolved from `domain` the way the
   * axis resolves it (`resolveSymlogConstant`); d3's 1 when absent.
   */
  symlogConstant?: number
  /** Whether the domain's minimum sits at the band's top rather than its bottom. */
  reverse?: boolean
}

/**
 * The two uniforms `valueScale.slang` reads a scale by, which the painter, the
 * ink box and the hit test read too.
 */
export function valueScaleUniforms({
  scaleType,
  symlogConstant = 1,
}: MarkValueScale) {
  return {
    valueScaleType: scaleTypeCode(scaleType),
    valueSymlogConstant: symlogConstant,
  }
}
