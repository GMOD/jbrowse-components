import { toLocale } from '@jbrowse/core/util'

/**
 * Min/max label strings for a Hi-C color legend, shared by the on-screen
 * overlay panel (HTML spans) and the SVG export legend (SVG text) so both
 * read identically. `maxLabel` carries the `(log)` suffix when relevant.
 *
 * The endpoints are the renderer's, not a niced version of them: the bar draws
 * ramp entry `t` at bar fraction `t`, so a rounded-outward maximum moves every
 * interior score on the bar. `mapHicCount` saturates at `colorMaxScore` under
 * the same two floors spelled here, and bottoms out at a count of 1 in log
 * scale (where it clamps the count up first) and 0 in linear.
 */
export function getHicScaleLabels(score: number, useLogScale: boolean) {
  const max = Math.max(score, useLogScale ? 2 : 0.001)
  return {
    minLabel: toLocale(useLogScale ? 1 : 0),
    maxLabel: `${toLocale(max)}${useLogScale ? ' (log)' : ''}`,
  }
}
