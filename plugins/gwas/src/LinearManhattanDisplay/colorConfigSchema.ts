import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import {
  CATEGORICAL_COLOR_SCALES,
  colorChannelOptions,
  colorChannelSlots,
  colorPaletteSlot,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * The field that is each point's r² to the index SNP, joined from the
 * `GWASAdapter`'s `ldAdapter` rather than read off the feature.
 */
export const LD_FIELD = 'ld'

/**
 * #config ManhattanColor
 * #category display
 * The Manhattan display's `color` setting: one CSS colour or `jexl:` callback
 * for every point, a field whose values each take a palette colour with a key,
 * or LocusZoom colouring by r² to the index SNP. A string is the constant; a
 * `field` binds the palette; `field: "ld"` reads the `GWASAdapter`'s
 * `ldAdapter`.
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
      scales: CATEGORICAL_COLOR_SCALES,
      scaleName: 'ManhattanColorScale',
      field:
        "the feature field whose values each take a palette colour, with a key listing the values met: name, refName, a BED extra column, a GFF attribute; ld is each point's r² to the index SNP, read from the GWASAdapter's ldAdapter",
      scale:
        'none paints value and keeps the field for a switch back; categorical a palette colour per value of field; unset follows field',
      domain:
        "the field's values that take the palette first, in order, in the key as on the points; the rest follow sorted, each on a colour no listed value paints",
    }),
    ...colorPaletteSlot(),
  },
  colorChannelOptions('color'),
)
