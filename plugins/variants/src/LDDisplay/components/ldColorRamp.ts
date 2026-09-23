import { rampLutOf } from '@jbrowse/core/util/colorRamp'

import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'

export function mapLDValue(ldVal: number) {
  return Math.max(0, Math.min(1, ldVal))
}

/**
 * What to call the number in a cell. Pre-computed LD files report magnitudes
 * (plink2's signed DPRIME is read through `Math.abs`), so there is one name per
 * metric — the tooltip and the legend both say it from here.
 */
export function ldMetricLabel(metric: string) {
  return metric === 'dprime' ? "D'" : 'R²'
}

/**
 * The number in a cell as the tooltip should print it.
 */
export function ldValueText(ldValue: number) {
  return ldValue.toFixed(3)
}

/** The named ramp a metric paints through: R² in reds, D′ in blues. */
export function ldColorScheme(metric: string): ColorSchemeName {
  return metric === 'dprime' ? 'blues' : 'reds'
}

export function generateLDColorRamp(metric: string): Uint8Array {
  return rampLutOf({ scheme: ldColorScheme(metric) })
}
