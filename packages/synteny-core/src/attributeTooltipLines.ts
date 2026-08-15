import { toLocale } from '@jbrowse/core/util'

import { colorByShortLabel } from './colorLegend.ts'
import { continuousRampConfig } from './colorRamps.ts'

import type { SyntenyColorBy } from './colorUtils.ts'

// Channel name -> the label the legend already uses for the mode that paints
// it, so a tooltip and a legend can't name the same number two ways. Derived
// from `continuousRampConfig` rather than hand-listed, since that is where the
// mode/channel pairing is decided. A channel no preset paints — a column an
// MCScan table declared — is printed under the name its author gave it, which
// is the point of declaring one.
const CHANNEL_LABELS = new Map(
  Object.entries(continuousRampConfig).map(([mode, { attribute }]) => [
    attribute,
    colorByShortLabel(mode as SyntenyColorBy),
  ]),
)

// Integers (mapping quality, a declared count) read better unabbreviated;
// ratios (identity, dn/ds) need their significant digits and not 17 of them.
function formatAttribute(value: number) {
  return Number.isInteger(value)
    ? toLocale(value)
    : String(Number(value.toPrecision(3)))
}

/**
 * The numeric channels one feature actually carries, keyed by channel name, in
 * the order the fetch allocated them. -1 is the worker's missing sentinel (see
 * `createAttributeChannels`), so a channel this feature has no value for is
 * absent rather than negative.
 */
export function featureAttributes(
  attributes: Record<string, ArrayLike<number>>,
  index: number,
) {
  const out: Record<string, number> = {}
  for (const [name, values] of Object.entries(attributes)) {
    const value = values[index]
    if (value !== undefined && value >= 0) {
      out[name] = value
    }
  }
  return out
}

/**
 * A feature's numeric channels as tooltip lines, shared by both comparative
 * views because they had drifted: the dotplot listed every channel, while the
 * synteny tooltip hand-wrote one `Identity:` line at a different precision and
 * silently dropped mapping quality, dN/dS, mean identity and every column the
 * track declared.
 */
export function attributeTooltipLines(values: Record<string, number>) {
  return Object.entries(values).map(
    ([name, value]) =>
      `${CHANNEL_LABELS.get(name) ?? name}: ${formatAttribute(value)}`,
  )
}
