import { cssColorToHex } from '../util/colorBits.ts'
import { rampLabels } from './colorScale.ts'

import type { ColorScale, RampScale } from './colorScale.ts'

/**
 * A ramp's bar as columns, for a host that draws the key itself, such as R
 * through V8: each stop's `offset`, `#rrggbb` `color` and `opacity`, and the
 * end labels the on-screen bar prints.
 */
export function rampKeyOf(scale: RampScale) {
  return {
    id: scale.id,
    title: scale.title ?? '',
    ...rampLabels(scale),
    offset: scale.stops.map(stop => stop.offset),
    color: scale.stops.map(stop => cssColorToHex(stop.color)),
    opacity: scale.stops.map(stop => stop.opacity ?? 1),
  }
}

/**
 * A display's color scales as the key a host draws: `legend`, each
 * categorical swatch's `label`, `#rrggbb` `color` and `section`, the title of
 * the scale it sits under, leaving out a note's row and a hidden one;
 * `legendTitle`, the first categorical scale's title; and `ramps`, each
 * ramp's bar (`rampKeyOf`).
 */
export function colorKeyTables(scales: readonly ColorScale[]) {
  const legend = {
    label: [] as string[],
    color: [] as string[],
    section: [] as string[],
  }
  let legendTitle: string | undefined
  for (const scale of scales) {
    if (scale.kind === 'categorical') {
      legendTitle ??= scale.title ?? ''
      for (const entry of scale.entries) {
        if (entry.color !== undefined && !entry.hidden) {
          legend.label.push(entry.label)
          legend.color.push(cssColorToHex(entry.color))
          legend.section.push(scale.title ?? '')
        }
      }
    }
  }
  return {
    legend,
    legendTitle: legendTitle ?? '',
    ramps: scales.filter(scale => scale.kind === 'ramp').map(rampKeyOf),
  }
}
