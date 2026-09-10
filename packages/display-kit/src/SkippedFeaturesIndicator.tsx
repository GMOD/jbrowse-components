import { pluralize } from '@jbrowse/core/util'

import TrackControl from './trackControl/TrackControl.tsx'

/** One encoded layer's share of a display's payload, as the summary reads it. */
export interface SkippedLayer {
  count: number
  skipped: number
  /** The channel the layer read for `y`, or undefined for a layer plotting none. */
  field: string | undefined
}

export interface SkippedFeatures {
  skipped: number
  total: number
  fields: string[]
}

/**
 * The encoder's skip counts over every loaded region, summed per layer.
 * `skipped` is the most any one layer left out — a feature every layer skips
 * is one feature — and `fields` names the `y` channels of the layers that
 * skipped any, in declaration order.
 */
export function skippedFeatures(
  layersByRegion: Iterable<readonly SkippedLayer[]>,
): SkippedFeatures {
  const perLayer: { skipped: number; total: number; field?: string }[] = []
  for (const layers of layersByRegion) {
    layers.forEach((layer, i) => {
      const acc = (perLayer[i] ??= { skipped: 0, total: 0, field: layer.field })
      acc.skipped += layer.skipped
      acc.total += layer.count + layer.skipped
    })
  }
  const fields: string[] = []
  let skipped = 0
  let total = 0
  for (const layer of perLayer) {
    skipped = Math.max(skipped, layer.skipped)
    total = Math.max(total, layer.total)
    if (layer.skipped > 0 && layer.field && !fields.includes(layer.field)) {
      fields.push(layer.field)
    }
  }
  return { skipped, total, fields }
}

/**
 * The bottom-right notice for a display whose worker skipped features the
 * encoder could not place: a mistyped score field is otherwise an empty
 * track with no message. Renders nothing when nothing was skipped.
 */
export default function SkippedFeaturesIndicator({
  skipped,
  total,
  fields,
}: SkippedFeatures) {
  if (skipped === 0) {
    return null
  }
  const reason =
    fields.length > 0
      ? `${fields.map(f => `\`${f}\``).join(', ')} missing or not a number`
      : '`start` or `end` not a number'
  return (
    <TrackControl
      icon="filter"
      warning
      label={`${skipped.toLocaleString()} of ${total.toLocaleString()} skipped`}
      tooltip={`${skipped.toLocaleString()} of ${total.toLocaleString()} ${pluralize(total, 'feature')} skipped: ${reason}`}
    />
  )
}
