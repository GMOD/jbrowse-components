import { scaleTypeCode } from '@jbrowse/render-core/scoreScale'
import { resolveSymlogConstant } from '@jbrowse/wiggle-core'

import type { MatrixScale } from './types.ts'
import type { ScaleType } from '@jbrowse/wiggle-core'

/**
 * The display's y scale as `getScoreMatrix` places its scores through it,
 * undefined on a linear axis or before the domain resolves.
 */
export function matrixScale({
  scaleType,
  domain,
  symlogConstant,
}: {
  scaleType: ScaleType
  domain: readonly [number, number] | undefined
  symlogConstant: number
}): MatrixScale | undefined {
  return domain && scaleType !== 'linear'
    ? {
        scaleType: scaleTypeCode(scaleType),
        domain,
        symlogConstant: resolveSymlogConstant(
          domain[0],
          domain[1],
          symlogConstant,
        ),
      }
    : undefined
}
