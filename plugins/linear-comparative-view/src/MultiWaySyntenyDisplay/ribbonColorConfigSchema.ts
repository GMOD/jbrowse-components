import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import {
  MEASURE_FIELD_PRESETS,
  withImpliedField,
} from '@jbrowse/core/util/colorScale'
import {
  colorChannelOptions,
  colorFieldSlot,
  colorLegendOptions,
  colorScaleOptions,
} from '@jbrowse/display-kit/colorConfigSchema'
import {
  paintedField,
  syntenyColorLegendSlots,
  syntenyColorScaleSlots,
} from '@jbrowse/synteny-core'

import type { SyntenyColorSnapshot } from '@jbrowse/synteny-core'

/** The field a ribbon color naming neither a field nor a constant paints. */
export const RIBBON_IMPLIED_FIELD = 'strand'

/** Every ribbon's color under no field. */
export const RIBBON_GREY = 'rgb(130,130,130)'

/**
 * The ribbon color channel as it paints: the field mapped, and the color of
 * every ribbon under no field or of a pair with no value under one, the
 * no-value grey every display paints unless `scale.invalid` names another.
 */
export function paintedRibbonColor(setting: SyntenyColorSnapshot) {
  const color = withImpliedField(setting, RIBBON_IMPLIED_FIELD)
  const field = paintedField(color)
  return {
    value:
      field === undefined
        ? (color.value ?? RIBBON_GREY)
        : (color.scale?.invalid ?? NO_CATEGORY_COLOR),
    field,
  }
}

/**
 * #config RibbonColor
 * #category display
 * The multi-way synteny display's `ribbons.encoding.color`: one color for
 * every ribbon, or a field each ribbon carries: the record's strand (the
 * default, while the channel names neither a field nor a color), a
 * measurement through its preset (`identity`, `mapq`, `dnds`,
 * `syntenicDepth`), or a column the table declares in `attributeColumns`,
 * through the same slots as the synteny view's
 * [SyntenyColor](../syntenycolor). A string is the field.
 *
 * #example
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   ribbons: { encoding: { color: { value: 'grey' } } },
 * }
 * ```
 * ```js
 * { type: 'MultiWaySyntenyDisplay', ribbons: { encoding: { color: 'strand' } } }
 * ```
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   ribbons: {
 *     encoding: {
 *       color: {
 *         field: 'strand',
 *         scale: {
 *           range: ['#1b9e77', '#d95f02'],
 *           names: ['Kept', 'Inverted'],
 *         },
 *       },
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   ribbons: {
 *     encoding: {
 *       color: {
 *         field: 'group',
 *         scale: { domain: ['core', 'shell'], invalid: 'lightgrey' },
 *       },
 *     },
 *   },
 * }
 * ```
 */
export const ribbonColorConfigSchema = ConfigurationSchema(
  'RibbonColor',
  {
    /**
     * #slot value
     * The color of every ribbon while no field paints.
     */
    value: {
      type: 'maybeColor',
      description:
        'the color of the ribbons connecting adjacent lanes; unset with no field, the ribbons are colored by strand',
    },
    ...colorFieldSlot({
      fieldType: 'string',
      field:
        "field to color each ribbon by: strand reads the relative strand between the two lanes the ribbon joins (the two placements' orientations multiplied out, not the drawn twist, so a flipped lane still shows its inversions); identity and dnds paint their preset ramps, mapq its bins and syntenicDepth one-to-one against shared orthologs, as the synteny view's do; any other name is a column the table declares in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a color column put beside it)",
    }),
    /**
     * #slot scale
     * How the field's values map to colors, Vega-Lite's scale object.
     */
    scale: ConfigurationSchema(
      'RibbonColorScale',
      syntenyColorScaleSlots('RibbonColorScaleType'),
      colorScaleOptions('ribbons.encoding.color.scale'),
    ),
    /**
     * #slot legend
     * The key this channel draws.
     */
    legend: ConfigurationSchema(
      'RibbonColorLegend',
      syntenyColorLegendSlots,
      colorLegendOptions,
    ),
  },
  colorChannelOptions('ribbons.encoding.color', MEASURE_FIELD_PRESETS, {
    impliedField: RIBBON_IMPLIED_FIELD,
  }),
)
