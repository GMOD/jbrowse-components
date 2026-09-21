import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import {
  colorChannelOptions,
  colorChannelSlots,
  colorDomainSlot,
  colorRangeSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

const MANHATTAN_COLOR_SCALES = ['none', 'categorical', 'threshold'] as const

/**
 * The field that is each point's r² to the index SNP, joined from the
 * `GWASAdapter`'s `ldAdapter` rather than read off the feature.
 */
export const LD_FIELD = 'ld'

/**
 * #config ManhattanColor
 * #category display
 * The Manhattan display's `color` setting: one CSS colour or `jexl:` callback
 * for every point, a field whose values each take a range colour with a key,
 * a numeric field cut into intervals by a `threshold` scale, or LocusZoom
 * colouring by r² to the index SNP — which is that threshold scale over
 * `field: "ld"`, whose cuts and colours a config may move. A string is the
 * constant; a `field` binds the range; `field: "ld"` reads the
 * `GWASAdapter`'s `ldAdapter`.
 *
 * #example
 * ```js
 * { type: 'LinearManhattanDisplay', color: 'goldenrod' }
 * ```
 * ```js
 * {
 *   type: 'LinearManhattanDisplay',
 *   color: { field: 'population', domain: ['EUR', 'AFR'] },
 * }
 * ```
 * ```js
 * { type: 'LinearManhattanDisplay', color: { field: 'ld' } }
 * ```
 * ```js
 * {
 *   type: 'LinearManhattanDisplay',
 *   color: {
 *     field: 'ld',
 *     scale: 'threshold',
 *     domain: [0.5],
 *     range: ['#357ebd', '#d43f3a'],
 *   },
 * }
 * ```
 */
export const manhattanColorConfigSchema = ConfigurationSchema(
  'ManhattanColor',
  {
    /**
     * #slot value
     * A CSS colour, or a jexl callback over `feature` returning one, for every
     * point under the `none` scale. Writing `color: "red"` lands here.
     */
    value: {
      type: 'color',
      defaultValue: DEFAULT_MARK_COLOR,
      description: 'CSS color or jexl callback for Manhattan points',
      contextVariable: ['feature'],
    },
    ...colorChannelSlots({
      scales: MANHATTAN_COLOR_SCALES,
      scaleName: 'ManhattanColorScale',
      field:
        "the feature field whose values each take a range colour, with a key listing the values met: name, refName, a BED extra column, a GFF attribute; ld is each point's r² to the index SNP, read from the GWASAdapter's ldAdapter",
      scale:
        'none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points domain lists; unset follows field, and is threshold over ld and categorical over anything else',
    }),
    ...colorDomainSlot({
      domain:
        "under a categorical scale, the field's values that take the range first, in order, in the key as on the points, the rest following sorted, each on a colour no listed value paints; under a threshold scale, the cut points in ascending order, range taking one entry more than this, one per interval; r² to the index SNP cuts at 0.2, 0.4, 0.6 and 0.8 into the LocusZoom blue-through-red bins unless these say otherwise",
    }),
    ...colorRangeSlot({
      range:
        'CSS colours a categorical scale hands its domain in order, continuing into the default palette past its end, or a threshold scale hands its intervals, lowest first',
    }),
  },
  colorChannelOptions('color'),
)
