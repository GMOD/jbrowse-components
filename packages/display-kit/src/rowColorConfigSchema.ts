import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  colorDomainSlot,
  colorRangeSlot,
  colorScaleOptions,
  colorUnknownSlot,
} from './colorConfigSchema.ts'

/**
 * #config RowColor
 * #category display
 * The `rowColor` setting of the row displays: one ordinal color channel on
 * the row axis. `field` names the row attribute whose values take the
 * colors, `name` (the row itself) by default, and `scale.domain` and
 * `scale.range` pair those values with CSS colors, so a color a reader sets on a row in the
 * arrangement dialog is an entry under `name`. Each display paints it on the
 * element that identifies a row: the quantitative display's plot, or
 * the tint beside its label while a score gradient paints; the multi-row
 * feature display's blocks; the multi-sample variant displays' label tint; the
 * MAF display's label tint, over the adapter's `samples[].color`; the mark
 * display's label tint, over a listed source's color. Where the rows have
 * attributes (a samplesTsv column or a subtrack's group), `field` may name one,
 * and its values each take a palette color. Under `name` the palette deals only
 * where the rows share one panel, a wiggle overlay; stacked rows are identified by
 * their labels. `scale.unknown: ''` deals none, so only the values
 * `scale.domain` lists take a color and every other row keeps the color it
 * already has. A string is the field.
 *
 * A channel of its own beside `rows`, not `rows.color`: it has its own
 * `field`, palette and key, so a write of `rows` replaces the arrangement
 * and leaves the colors. A pick of another rows field in a menu or the Edit
 * plot form drops the `name` pairs, which name the old field's rows. Nor is it `encoding.color`, which on wiggle and the
 * mark display paints by value.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rowColor: {
 *     scale: { domain: ['tumor', 'normal'], range: ['#b2182b', '#2166ac'] },
 *   },
 * }
 * ```
 * ```js
 * { type: 'LinearMultiSampleVariantDisplay', rowColor: 'population' }
 * ```
 * ```js
 * {
 *   type: 'LinearMultiRowFeatureDisplay',
 *   rowColor: {
 *     scale: { domain: ['mom'], range: ['#b2182b'], unknown: '#cccccc' },
 *   },
 * }
 * ```
 */
export const rowColorConfigSchema = ConfigurationSchema(
  'RowColor',
  {
    /**
     * #slot
     */
    field: {
      type: 'string',
      defaultValue: 'name',
      description:
        "the row attribute whose values take the colors: name, the row itself, or an attribute of the rows, such as a column of a multi-sample variant adapter's samplesTsvLocation, e.g. population, or a subtrack's group",
    },
    /**
     * #slot scale
     * Which color each value of the field takes.
     */
    scale: ConfigurationSchema(
      'RowColorScale',
      {
        ...colorDomainSlot({
          domain:
            "the field's values that get a color, in order: under name, rows by name",
        }),
        ...colorRangeSlot({
          range: 'the CSS color each value in domain takes, in the same order',
        }),
        ...colorUnknownSlot,
      },
      colorScaleOptions('rowColor.scale'),
    ),
  },
  {
    shorthand: 'field',
    writes: 'whole',
    plot: true,
    closed: true,
  },
)

/**
 * `rowColor` once the rows take another field. Under `name` its `domain`
 * names the old field's rows, so those pairs go; the `range` past them, the
 * colors every other row deals from first, and `unknown` stay. Colors by an
 * attribute stay whole.
 */
export function rowColorForOtherRows(
  rowColor: Record<string, unknown>,
): Record<string, unknown> {
  const { field = 'name' } = rowColor
  const scale = (rowColor.scale ?? {}) as Record<string, unknown>
  const { domain, range, ...rest } = scale
  if (field !== 'name' || !Array.isArray(domain) || domain.length === 0) {
    return rowColor
  }
  const spare = Array.isArray(range) ? range.slice(domain.length) : []
  return {
    ...rowColor,
    scale: { ...rest, ...(spare.length > 0 ? { range: spare } : {}) },
  }
}
