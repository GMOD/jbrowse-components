/** One encoded layer's share of a display's payload, as the summary reads it. */
export interface SkippedLayer {
  count: number
  skipped: number
  /** The channel the layer read for `y`, or undefined for a layer plotting none. */
  field: string | undefined
  /** Of `skipped`, those whose position read no number; absent is none. */
  skippedPosition?: number
  /** The fields the layer's position came from, which those are blamed on. */
  positionFields?: readonly string[]
}

export interface SkippedFeatures {
  skipped: number
  total: number
  fields: string[]
}

/**
 * The encoder's skip counts over every loaded region, summed per layer.
 * `skipped` is the most any one layer left out — a feature every layer skips
 * is one feature — and `fields` names what the layers that skipped any
 * could not read, in declaration order: the position's fields for a feature
 * with no position, the `y` channel for the rest.
 */
export function skippedFeatures(
  layersByRegion: Iterable<readonly SkippedLayer[]>,
): SkippedFeatures {
  const perLayer: Required<SkippedLayer>[] = []
  for (const layers of layersByRegion) {
    layers.forEach((layer, i) => {
      const acc = (perLayer[i] ??= {
        count: 0,
        skipped: 0,
        skippedPosition: 0,
        field: layer.field,
        positionFields: layer.positionFields ?? [],
      })
      acc.count += layer.count
      acc.skipped += layer.skipped
      acc.skippedPosition += layer.skippedPosition ?? 0
    })
  }
  const fields: string[] = []
  let skipped = 0
  let total = 0
  for (const layer of perLayer) {
    skipped = Math.max(skipped, layer.skipped)
    total = Math.max(total, layer.count + layer.skipped)
    const blamed = [
      ...(layer.skippedPosition > 0 ? layer.positionFields : []),
      ...(layer.skipped > layer.skippedPosition && layer.field
        ? [layer.field]
        : []),
    ]
    for (const field of blamed) {
      if (!fields.includes(field)) {
        fields.push(field)
      }
    }
  }
  return { skipped, total, fields }
}
