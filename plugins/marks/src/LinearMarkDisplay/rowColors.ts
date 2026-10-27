import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { ColorSource } from './markColor.ts'
import type { MarkRegionData } from './markList.ts'

/**
 * A categorical color over the field the rows split on, painting each value
 * in its row's color where the row has one (ADR-251), and the color's own
 * `domain` and `range` for the rest. Any other color as it came.
 *
 * The written `domain` keeps its order, since the key pairs `scale.names`
 * with it by position; the rows' other colored values follow it. A written
 * value with no color of either kind ends the colored run, and the values
 * from it on take the palette, as a `domain` longer than its `range` does.
 */
export function withRowScale(
  source: ColorSource,
  rowsField: string,
  colors: ReadonlyMap<string, string>,
): ColorSource {
  if (
    source.kind !== 'categories' ||
    source.encoding.field !== rowsField ||
    colors.size === 0
  ) {
    return source
  }
  const { domain = [], range = [] } = source.encoding
  const written = domain.map(String)
  const listed = new Set(written)
  const extra = [...colors.keys()].filter(value => !listed.has(value))
  const own = written.map((value, i) => colors.get(value) ?? range[i])
  const gap = own.indexOf(undefined)
  return {
    ...source,
    encoding: {
      ...source.encoding,
      domain: [...written, ...extra],
      range:
        gap === -1
          ? [
              ...(own as string[]),
              ...extra.map(value => colors.get(value)!),
              // the spare range past the domain still deals to unlisted values
              ...range.slice(written.length),
            ]
          : (own.slice(0, gap) as string[]),
    },
  }
}

/** Which marks paint in their rows' colors, and each row's color by name. */
export interface RowColors {
  marks: readonly boolean[]
  colors: ReadonlyMap<string, string>
}

/**
 * The region with each instance of a mark `rowColors` lists taking its row's
 * color, the layer's own constant where the row has none. A keyed region
 * only: its `row` lane holds the keys `names` spells.
 */
export function withRowColors(
  region: MarkRegionData,
  rowColors: RowColors,
  names: readonly string[],
): MarkRegionData {
  const abgrOfKey = new Map<number, number | undefined>()
  const abgrOf = (key: number) => {
    if (!abgrOfKey.has(key)) {
      const css = rowColors.colors.get(names[key] ?? '')
      abgrOfKey.set(key, css === undefined ? undefined : cssColorToABGR(css))
    }
    return abgrOfKey.get(key)
  }
  const layers = region.layers.map((layer, i) => {
    const { row, color } = layer
    if (!rowColors.marks[i] || !row || typeof color !== 'number') {
      return layer
    }
    const painted = new Uint32Array(layer.count)
    for (let k = 0; k < layer.count; k++) {
      painted[k] = abgrOf(row[k]!) ?? color
    }
    return { ...layer, color: painted }
  })
  return layers.every((layer, i) => layer === region.layers[i])
    ? region
    : { ...region, layers }
}
