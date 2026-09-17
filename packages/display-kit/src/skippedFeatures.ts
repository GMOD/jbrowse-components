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
