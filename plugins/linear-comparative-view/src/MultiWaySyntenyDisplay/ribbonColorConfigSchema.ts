import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  MEASURE_FIELD_PRESETS,
  withImpliedField,
} from '@jbrowse/core/util/colorScale'
import { colorChannelOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { paintedField, syntenyColorSlots } from '@jbrowse/synteny-core'

import type { SyntenyColorSnapshot } from '@jbrowse/synteny-core'

/** The field a ribbon color naming neither a field nor a constant paints. */
export const RIBBON_IMPLIED_FIELD = 'strand'

/** Every ribbon's color under no field, and an unlabelled pair's under one. */
export const RIBBON_GREY = 'rgba(130,130,130,0.3)'

/** The ribbon color object as it paints: the constant, and the field mapped. */
export function paintedRibbonColor(setting: SyntenyColorSnapshot) {
  const color = withImpliedField(setting, RIBBON_IMPLIED_FIELD)
  return { value: color.value ?? RIBBON_GREY, field: paintedField(color) }
}

/**
 * #config RibbonColor
 * #category display
 * The multi-way synteny display's `ribbonColor` setting: one color for every
 * ribbon, or a field each ribbon carries: the record's strand (the default,
 * while the setting names neither a field nor a color), a measurement
 * through its preset (`identity`, `mapq`, `dnds`, `syntenicDepth`), or a column the table
 * declares in `attributeColumns`, through the same slots as the synteny
 * view's [SyntenyColor](../syntenycolor). A string is the constant.
 *
 * #example
 * ```js
 * { type: 'MultiWaySyntenyDisplay', ribbonColor: 'rgba(130,130,130,0.3)' }
 * ```
 * ```js
 * { type: 'MultiWaySyntenyDisplay', ribbonColor: { field: 'strand' } }
 * ```
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   ribbonColor: {
 *     field: 'strand',
 *     range: ['#1b9e77', '#d95f02'],
 *     labels: ['Kept', 'Inverted'],
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   ribbonColor: { field: 'group', domain: ['core', 'shell'] },
 * }
 * ```
 */
export const ribbonColorConfigSchema = ConfigurationSchema(
  'RibbonColor',
  {
    /**
     * #slot value
     * The color of every ribbon under the `none` scale, and of a pair
     * with no value under a field.
     */
    value: {
      type: 'maybeColor',
      description:
        'the color of the ribbons connecting adjacent lanes; unset with no field, the ribbons are colored by strand, and a field paints rgba(130,130,130,0.3) where a pair has no value',
    },
    ...syntenyColorSlots({
      scaleName: 'RibbonColorScale',
      field:
        "field to color each ribbon by: strand reads the relative strand between the two lanes the ribbon joins (the two placements' orientations multiplied out, not the drawn twist, so a flipped lane still shows its inversions); identity and dnds paint their preset ramps, mapq its bins and syntenicDepth one-to-one against shared orthologs, as the synteny view's do; any other name is a column the table declares in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a color column put beside it)",
    }),
  },
  colorChannelOptions('ribbonColor', MEASURE_FIELD_PRESETS, {
    impliedField: RIBBON_IMPLIED_FIELD,
  }),
)
