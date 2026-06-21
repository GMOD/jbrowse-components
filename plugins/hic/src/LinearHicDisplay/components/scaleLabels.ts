import { toLocale } from '@jbrowse/core/util'
import { getNiceScale } from '@jbrowse/wiggle-core'

/**
 * Min/max label strings for a Hi-C color legend, shared by the on-screen
 * overlay panel (HTML spans) and the SVG export legend (SVG text) so both
 * read identically. `maxLabel` carries the `(log)` suffix when relevant.
 */
export function getHicScaleLabels(score: number, useLogScale?: boolean) {
  const { min, max } = getNiceScale(score, useLogScale)
  return {
    minLabel: min !== undefined ? toLocale(min) : '',
    maxLabel: `${max !== undefined ? toLocale(max) : ''}${useLogScale ? ' (log)' : ''}`,
  }
}
