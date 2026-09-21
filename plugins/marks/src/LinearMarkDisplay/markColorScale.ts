import { paintedScale } from './markRuleFacts.ts'

import type { ColorScaleName } from './markRuleFacts.ts'

export type MarkColorScale = ColorScaleName

/**
 * The scale a mark's colour paints through: left unset beside a `field`,
 * `linear` with a `ramp` and `categorical` without.
 */
export function markColorScale(color: {
  scale: MarkColorScale | undefined
  field: string
  ramp: readonly string[]
}) {
  return paintedScale(color, color.ramp.length > 0 ? 'linear' : 'categorical')
}
