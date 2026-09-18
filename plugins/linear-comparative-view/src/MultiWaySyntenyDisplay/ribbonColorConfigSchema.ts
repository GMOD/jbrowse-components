import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { normalizeChannel } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

// How a ribbon takes its colour: `none` paints `value`; `categorical` reads a
// column the table declares in `attributeColumns`; the rest are the synteny
// view's schemes of the same names.
export const RIBBON_COLOR_SCALES = [
  'none',
  'categorical',
  'strand',
  'identity',
  'mappingQuality',
  'dnds',
] as const

/**
 * #config RibbonColor
 * #category display
 * The multi-way synteny display's `ribbonColor` setting: one colour for every
 * ribbon, a scheme the synteny view also paints, or a column the table
 * declares in `attributeColumns`. A string is the constant.
 *
 * #example
 * ```js
 * { type: 'MultiWaySyntenyDisplay', ribbonColor: 'rgba(130,130,130,0.3)' }
 * ```
 * ```js
 * { type: 'MultiWaySyntenyDisplay', ribbonColor: { scale: 'strand' } }
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
     * carrying no value under the others. Writing `ribbonColor: "grey"`
     * lands here. Every scale keeps its opacity.
     */
    value: {
      type: 'color',
      description: 'the color of the ribbons connecting adjacent lanes',
      defaultValue: 'rgba(130,130,130,0.3)',
    },
    /**
     * #slot field
     * A column the table declares in `attributeColumns`: a ramp over the
     * values seen for numbers, one colour per label for text (or the colour a
     * `color` column put beside it).
     */
    field: {
      type: 'string',
      defaultValue: '',
      description: 'a declared attribute column to color by',
    },
    /**
     * #slot scale
     * What colours a ribbon. `none` paints `value`; `categorical` reads
     * `field`; `strand` reads the record's strand — the two placements'
     * orientations against the anchor multiplied out — and not the drawn
     * twist, so a lane drawn flipped still shows its inversions; `identity`,
     * `mappingQuality` and `dnds` paint the synteny view's ramps. Unset, a
     * `field` reads through `categorical` and no field paints `value`. A
     * `field` under another scale is kept for a switch back.
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('RibbonColorScale', [...RIBBON_COLOR_SCALES]),
      description:
        'none, categorical, strand, identity, mappingQuality or dnds; unset follows field',
    },
    /**
     * #slot domain
     * The order a text column's labels take: the labels listed here first,
     * the rest sorted. A label's colour is its position, so this moves the key
     * and the ribbons together. Left empty the labels stay in the order the
     * fetches first met them.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: "the order a text column's labels take",
    },
  },
  {
    shorthand: 'value',
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'ribbonColor'),
  },
)
