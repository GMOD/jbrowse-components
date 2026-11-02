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
 * `rows.color`, the row displays' rows colored by an attribute: one ordinal
 * color channel on the row axis. `field` names the row attribute whose values
 * take the colors, a samplesTsv column or a subtrack's group, and
 * `scale.domain` and `scale.range` pair its values with CSS colors, the rest
 * each taking a palette color. Under `name`, the default, each row is its
 * own value: the palette (`scale.range`, then the row palette) deals one
 * color per row, and only where the rows share one panel, a wiggle overlay,
 * since stacked rows are identified by their labels; `scale.unknown` is the
 * color every row takes instead, `''` for none. A color pinned on one row is
 * `rows.colors`, which wins over this, so under `name` this takes no
 * `scale.domain`. A string is the field.
 *
 * Each display paints a row's color on the element that identifies a row: the
 * quantitative display's plot, or the tint beside its label while a score
 * gradient paints; the multi-row feature display's blocks; the variant
 * display's label tint; the MAF display's label tint, over the adapter's
 * `samples[].color`; the mark display's label tint, over a listed source's
 * color. Not `encoding.color`, which on wiggle and the mark display paints by
 * value.
 *
 * #example
 * ```js
 * { type: 'LinearVariantDisplay', rows: { color: 'population' } }
 * ```
 * ```js
 * {
 *   type: 'LinearVariantDisplay',
 *   rows: {
 *     color: {
 *       field: 'population',
 *       scale: { domain: ['EUR', 'AFR'], range: ['#1f77b4', '#ff7f0e'] },
 *     },
 *   },
 * }
 * ```
 * ```js
 * {
 *   type: 'LinearMultiRowFeatureDisplay',
 *   rows: { color: { scale: { unknown: '' } }, colors: { mom: '#b2182b' } },
 * }
 * ```
 */
export const rowColorConfigSchema = ConfigurationSchema(
  'RowColor',
  {
    /**
     * #slot field
     * The row attribute whose values take the colors, or `name`, each row
     * its own value. Under `name` with no `scale.unknown`, stacked rows keep
     * only a file's own colors and the colors `rows.colors` pins, since the
     * palette deals only where the rows share one panel.
     */
    field: {
      type: 'string',
      defaultValue: 'name',
      description:
        "the row attribute whose values take the colors: name, each row its own value, or an attribute of the rows, such as a column of a multi-sample variant adapter's samplesTsvLocation, e.g. population, or a subtrack's group; a color pinned on one row is rows.colors",
    },
    /**
     * #slot scale
     * Which color each value of the field takes. Under `name` it takes no
     * `domain`: a row's own color is `rows.colors`.
     */
    scale: ConfigurationSchema(
      'RowColorScale',
      {
        ...colorDomainSlot({
          domain:
            "the field's values that get a color, in order; none under name, where a row's own color is rows.colors",
        }),
        ...colorRangeSlot({
          range:
            'the CSS color each value in domain takes, in the same order; past them, the palette the other values deal from',
        }),
        ...colorUnknownSlot,
      },
      colorScaleOptions('rows.color.scale'),
    ),
  },
  {
    shorthand: 'field',
    writes: 'whole',
    plot: true,
    closed: true,
    refuses: [
      {
        id: 'row-colors-by-name',
        when: { field: ['name'] },
        slots: ['scale.domain'],
        message:
          "under field name a row's own color is rows.colors, the map beside rows.color, so scale.domain pairs only an attribute's values",
      },
    ],
  },
)
