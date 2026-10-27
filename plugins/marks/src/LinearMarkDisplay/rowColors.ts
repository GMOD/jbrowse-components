import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import type { ColorSource } from './markColor.ts'
import type { MarkRegionData } from './markList.ts'

/**
 * A categorical color over the field the rows split on, painting each value
 * in its row's color where the row has one (ADR-251), and the color's own
 * `domain` and `range` for the rest. Any other color as it came.
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
  const rest = domain.map(String).filter(value => !colors.has(value))
  const paired = new Map(domain.map((value, i) => [String(value), range[i]]))
  const colored = rest.filter(value => paired.get(value) !== undefined)
  const uncolored = rest.filter(value => paired.get(value) === undefined)
  return {
    ...source,
    encoding: {
      ...source.encoding,
      domain: [...colors.keys(), ...colored, ...uncolored],
      // a range past the domain deals its spare colors to unlisted values,
      // which only stays so while every listed value has its own
      range: [
        ...colors.values(),
        ...colored.map(value => paired.get(value)!),
        ...(uncolored.length === 0 ? range.slice(domain.length) : []),
      ],
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
