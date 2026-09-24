import { readConfObject } from '@jbrowse/core/configuration'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { derivedColorScale } from '@jbrowse/core/util/legendCandidates'
import {
  colorEncodingOf,
  colorFieldOf,
} from '@jbrowse/display-kit/colorConfigSchema'

import type { arcColorSchema } from './arcColorConfigSchema.ts'
import type { pairedArcColorSchema } from './pairedArcColorConfigSchema.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { Instance } from '@jbrowse/mobx-state-tree'

/** An arc display's `color` object as a config node. */
export type ArcColorNode =
  | Instance<typeof arcColorSchema>
  | Instance<typeof pairedArcColorSchema>

/**
 * How one arc is coloured: the CSS colour, and where a scale painted it, the
 * key its field value filed under, which the legend derives its rows from.
 */
export interface ArcPaint {
  color: string
  key?: string
}

/**
 * What the `color` object paints for each feature: `value`, a `jexl:`
 * callback included, while it names no field or sits under `none`, else the
 * field's value filed and coloured the way every categorical or threshold
 * channel does it. `alt` reaches the callback on the paired display.
 */
export function arcColorPainter(
  color: ArcColorNode,
  jexl: JexlInstance,
): (feature: Feature, alt?: string) => ArcPaint {
  const encoding = colorEncodingOf(color, 'categorical')
  const field = colorFieldOf(encoding)
  if (typeof encoding === 'string' || !field) {
    return (feature, alt) => ({
      color: readConfObject(color, 'value', { feature, alt }),
    })
  }
  const read = fieldReader(field.field, jexl)
  return feature => {
    const key = field.key(read(feature))
    return { key, color: field.color(key) }
  }
}

/**
 * The key the painted arcs derive: one row per colour, naming every value
 * painted in it, and nothing where `color` binds no field.
 */
export function arcColorScales(
  color: ArcColorNode,
  paints: readonly ArcPaint[],
): ColorScale[] {
  const field = colorFieldOf(colorEncodingOf(color, 'categorical'))
  if (!field) {
    return []
  }
  const painted = new Map<string, string>()
  for (const { key, color: css } of paints) {
    if (key !== undefined && !painted.has(key)) {
      painted.set(key, css)
    }
  }
  return derivedColorScale(
    [painted],
    keys => ({
      candidates: [...keys].map(([value, css]) => ({
        rowIndex: 0,
        value,
        color: cssColorToABGR(css),
      })),
      rowPaintsCandidateColor: () => true,
    }),
    { id: 'arc-color', field },
  )
}
