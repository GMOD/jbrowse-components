import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  colorChannelOptions,
  colorChannelSlots,
} from '@jbrowse/display-kit/colorConfigSchema'
import { SYNTENY_COLOR_SCALES } from '@jbrowse/synteny-core'

import type { ColorByOver } from '@jbrowse/synteny-core'

/** The fields the ribbons read as a mode of their own; a view reads more. */
export const RIBBON_COLOR_FIELDS = ['strand'] as const

/** The modes a ribbon paints, as the synteny Color by menu offers them. */
export type RibbonColorBy = ColorByOver<(typeof RIBBON_COLOR_FIELDS)[number]>

/**
 * #config RibbonColor
 * #category display
 * The multi-way synteny display's `ribbonColor` setting: one colour for every
 * ribbon, or a field each ribbon carries — the record's strand, a measurement
 * on its preset ramp (`identity`, `mappingQual`, `dnds`), or a column the
 * table declares in `attributeColumns`. A string is the constant.
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
 *   ribbonColor: { field: 'group', domain: ['core', 'shell'] },
 * }
 * ```
 */
export const ribbonColorConfigSchema = ConfigurationSchema(
  'RibbonColor',
  {
    /**
     * #slot value
     * The colour of every ribbon under the `none` scale, and of a pair
     * carrying no value under a field. Writing `ribbonColor: "grey"` lands
     * here. Every field keeps its opacity.
     */
    value: {
      type: 'color',
      description: 'the color of the ribbons connecting adjacent lanes',
      defaultValue: 'rgba(130,130,130,0.3)',
    },
    ...colorChannelSlots({
      scales: SYNTENY_COLOR_SCALES,
      scaleName: 'RibbonColorScale',
      field:
        "what colours a ribbon: strand reads the record's strand against the anchor (the two placements' orientations multiplied out, not the drawn twist, so a flipped lane still shows its inversions); identity, mappingQual and dnds paint the synteny view's ramps; any other name is a column the table declares in attributeColumns, a ramp over the values seen for numbers and one colour per label for text (or the colour a color column put beside it)",
      scale:
        'none paints value and keeps the field for a switch back; unset, a field paints',
      domain:
        "the order a text column's labels take: the labels listed here first, the rest sorted; a label's colour is its position, so this moves the key and the ribbons together; left empty the labels stay in the order the fetches first met them",
    }),
  },
  colorChannelOptions('ribbonColor'),
)
