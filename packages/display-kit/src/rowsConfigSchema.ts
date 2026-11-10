import { ConfigurationSchema, keyedBase } from '@jbrowse/core/configuration'

import { rowAnnotationList } from './rowAnnotationConfigSchema.ts'
import {
  ROW_ARRANGEMENT_MEMBERS,
  rowArrangementConfigSchema,
} from './rowArrangementConfigSchema.ts'
import { rowAxisWithGridConfigSchema } from './rowAxisWithGridConfigSchema.ts'
import { rowFilterList } from './rowPredicateConfigSchema.ts'

/**
 * How `rows` is written: the arrangement members name the values of `field`,
 * so a write changing it clears them.
 */
export const ROWS_WRITES = {
  keyedBy: 'field',
  keyed: ROW_ARRANGEMENT_MEMBERS,
} as const

/**
 * `snap.annotations` as the list of channels it fills, a lone field or
 * channel object read as a list of one, as a launch arg
 * `rows.annotations=sex` writes it, and `''` as none.
 */
function annotationList(snap: Record<string, unknown>) {
  const { annotations } = snap
  return annotations === undefined || Array.isArray(annotations)
    ? {}
    : { annotations: annotations === '' ? [] : [annotations] }
}

/**
 * #config Rows
 * #category display
 * The `rows` setting of the displays that draw one row per value of a field,
 * with the dendrogram sidebar beside them: a [RowArrangement](../rowarrangement)
 * plus the `field`, `filter`, which narrows the rows by attribute,
 * `annotations`, the attributes drawn as color columns beside the labels, and
 * an axis with `grid`. A string is the field; the arrangement members name rows by
 * value of the field, so a write changing it clears them.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', rows: 'source' }
 * ```
 * ```js
 * { type: 'LinearMultiRowFeatureDisplay', rows: 'sample' }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rows: { field: 'source', sort: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
 * }
 * ```
 */
export const rowsConfigSchema = ConfigurationSchema(
  'Rows',
  {
    /**
     * #slot field
     * The field whose values each take a row. Writing
     * `rows: "source"` sets this slot. Empty is the display's default: no rows on
     * the quantitative display, and a field picked off the data on the
     * multi-row feature display.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description: 'the field whose values each take a row',
    },
    /**
     * #slot filter
     * The rows shown by attribute: a list of [RowPredicate](../rowpredicate)
     * entries over a row attribute, each one a row must pass: a samplesTsv
     * column on the variant display (`[{ field: 'population', oneOf: ['EUR',
     * 'AFR'] }]`), a subtrack's field such as `group` on wiggle, and `group`,
     * which `rows.groups` derives, on the mark displays. A row missing the
     * attribute fails every test but `valid: false`. It narrows the rows
     * before `kept`, and a write changing `field` keeps it, since it names no
     * row by its value; a row's name goes in `kept`.
     */
    filter: rowFilterList(),
    /**
     * #slot annotations
     * Extra color columns beside the row labels, one per row attribute, as
     * ggtree's `gheatmap` and ComplexHeatmap's row annotation draw them: a
     * list of [RowAnnotation](../rowannotation) entries, each a field or
     * `{ field, scale: { domain, range, unknown }, legend: { title } }`,
     * drawn in the order listed after the row's own color. Categorical
     * only: each value of the field takes a color the way `rows.color`
     * deals one, a row with no value leaves a gap, a field no row carries
     * draws nothing, and each column gets a key titled `legend.title`, else
     * the field. An entry with no field, or on `name`, is refused. It
     * reorders no row, so under one tree several attributes read against
     * the same clusters. Like `filter` it names no row: "Reset row order"
     * and a write changing `field` keep it.
     */
    annotations: rowAnnotationList(),
    /**
     * #slot axis
     * The guide down the left of the rows, a
     * [RowAxisWithGrid](../rowaxiswithgrid): whether the tree and the row
     * names draw, the sidebar's width, and a line between rows. What it draws
     * is `rows.tree` and `rows.labels`.
     */
    axis: rowAxisWithGridConfigSchema,
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowArrangementConfigSchema,
    shorthand: 'field',
    writes: ROWS_WRITES,
    preProcessSnapshot: snap => ({ ...snap, ...annotationList(snap) }),
  },
)

/**
 * The rows a pick of `field` writes over `current`, by the keyed rule
 * (ADR-257): the field in force keeps its arrangement, and another drops it,
 * since kept it would relabel, hide or draw a tree over the new field's rows
 * wherever the two share a value. A pick over no field keeps it.
 */
export function rowsForField(
  current: Record<string, unknown>,
  field: string,
): Record<string, unknown> {
  return field === (current.field ?? '')
    ? current
    : { ...keyedBase(ROWS_WRITES, current, { field }), field }
}
