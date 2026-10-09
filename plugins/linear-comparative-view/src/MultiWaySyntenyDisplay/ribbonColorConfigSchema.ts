import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { MEASURE_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import { colorChannelOptions } from '@jbrowse/display-kit/colorConfigSchema'
import { syntenyColorSlots } from '@jbrowse/synteny-core'

/**
 * #config RibbonColor
 * #category display
 * The multi-way synteny display's `ribbonColor` setting: one color for every
 * ribbon, or a field each ribbon carries: the record's strand, a measurement
 * through its preset (`identity`, `mapq`, `dnds`), or a column the table
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
     * carrying no value under a field.
     */
    value: {
      type: 'color',
      description: 'the color of the ribbons connecting adjacent lanes',
      defaultValue: 'rgba(130,130,130,0.3)',
    },
    ...syntenyColorSlots({
      scaleName: 'RibbonColorScale',
      field:
        "what colors a ribbon: strand reads the relative strand between the two lanes the ribbon joins (the two placements' orientations multiplied out, not the drawn twist, so a flipped lane still shows its inversions); identity and dnds paint their preset ramps and mapq its bins, as the synteny view's do; any other name is a column the table declares in attributeColumns, a ramp over the values seen for numbers and one color per label for text (or the color a color column put beside it)",
    }),
  },
  colorChannelOptions('ribbonColor', MEASURE_FIELD_PRESETS),
)
