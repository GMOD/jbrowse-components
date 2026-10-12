import { cssColorToHex } from '../util/colorBits.ts'
import { rampLabels } from './colorScale.ts'

import type { RampScale } from './colorScale.ts'

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
