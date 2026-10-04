import { LD_FIELD_PRESETS } from '../ldColorConfigSchema.ts'

import type { LDMetric } from '../../VariantRPC/ldTypes.ts'

/**
 * What to call the number in a cell: the metric's preset title. Pre-computed
 * LD files report magnitudes (plink2's signed DPRIME is read through
 * `Math.abs`), so there is one name per metric, and the tooltip and the
 * legend both say it.
 */
export function ldMetricLabel(metric: LDMetric) {
  return LD_FIELD_PRESETS[metric].title
}

/**
 * The number in a cell as the tooltip should print it.
 */
export function ldValueText(ldValue: number) {
  return ldValue.toFixed(3)
}
