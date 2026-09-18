import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import { normalizeChannel } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

import { MANHATTAN_COLOR_SCALES } from '../ManhattanRPC/rpcTypes.ts'

/**
 * #config ManhattanColor
 * #category display
 * The Manhattan display's `color` setting: one CSS colour or `jexl:` callback
 * for every point, a field whose values each take a palette colour with a key,
 * or LocusZoom colouring by r² to the index SNP. A string is the constant; a
 * `field` binds the palette; `scale: "ld"` reads the `GWASAdapter`'s
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
 * { type: 'LinearManhattanDisplay', color: { scale: 'ld' } }
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
    /**
     * #slot field
     * The feature field whose values each take a palette colour, with a key
     * listing the values met: `name`, `refName`, a BED extra column, a GFF
     * attribute. A value keeps its colour across regions and sessions.
     */
    field: {
      type: 'string',
      defaultValue: '',
      description: 'feature field whose values color the points',
    },
    /**
     * #slot scale
     * How the points take their colour. `none` paints `value`; `categorical`
     * a palette colour per value of `field`; `ld` each point's r² to the
     * index SNP, read from the `GWASAdapter`'s `ldAdapter` sub-adapter. Unset,
     * a `field` reads through `categorical` and no field paints `value`. A
     * `field` under `none` or `ld` is kept for a switch back.
     */
    scale: {
      type: 'maybeStringEnum',
      model: types.enumeration('ManhattanColorScale', [
        ...MANHATTAN_COLOR_SCALES,
      ]),
      description: 'none, categorical or ld; unset follows field',
    },
    /**
     * #slot domain
     * The field's values that take the palette first, in order, in the key
     * as on the points; the rest follow sorted, each on a colour no listed
     * value paints.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description: 'values that take the palette first, in order',
    },
    /**
     * #slot palette
     * The CSS colours `domain` hands out, in order, continuing into the
     * default palette past its end. Empty is the default palette.
     */
    palette: {
      type: 'stringArray',
      defaultValue: [],
      description: 'CSS colors the values take, in order',
    },
  },
  {
    shorthand: 'value',
    closed: true,
    preProcessSnapshot: snap => normalizeChannel(snap, 'color'),
  },
)
