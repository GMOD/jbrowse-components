import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { derivedColorScale } from '@jbrowse/core/util/legendCandidates'

import type {
  ColorValues,
  SectionStamp,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'

/**
 * The key the color field derives from the values the worker found, each
 * painted through `field`, less a value only a hidden section carries. `order`
 * lists and names the rows: the facet's field where the facet reads the same
 * one, so the key runs in the sections' order.
 */
export function derivedColorKey(
  field: CategoricalField,
  regions: Iterable<{ colorValues?: ColorValues }>,
  isHidden?: (section: SectionStamp) => boolean,
  order: CategoricalField = field,
): ColorScale[] {
  const packed = new Map<string, number>()
  const colorOf = (key: string) => {
    let color = packed.get(key)
    if (color === undefined) {
      color = cssColorToABGR(field.color(key))
      packed.set(key, color)
    }
    return color
  }
  return derivedColorScale(
    regions,
    ({ colorValues }) => ({
      candidates:
        colorValues?.painted.map(({ rowIndex, valueIndex }) => {
          const value = field.key(colorValues.values[valueIndex])
          return { rowIndex, value, color: colorOf(value) }
        }) ?? [],
      rowPaintsCandidateColor: rowIndex => {
        const section = colorValues?.rows[rowIndex]
        return !(isHidden && section && isHidden(section))
      },
    }),
    { id: 'color', field: order },
  )
}
