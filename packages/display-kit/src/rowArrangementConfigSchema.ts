import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { rowAxisConfigSchema } from './rowAxisConfigSchema.ts'
import { rowColorConfigSchema } from './rowColorConfigSchema.ts'
import { rowTreeConfigSchema } from './rowTreeConfigSchema.ts'

/**
 * The members naming a row by its name, which a reader's arrangement writes
 * and "Reset row order" returns: every slot but the axis, the color channel
 * and the annotations, which name no row.
 */
export const ROW_ARRANGEMENT_MEMBERS = [
  'sort',
  'labels',
  'colors',
  'tree',
  'kept',
] as const

/**
 * `snap[key]` as the list of strings it fills, a lone string or number read
 * as a list of one, as a launch arg `rows.sort=HG002` writes it, and `''` as
 * none. Anything else that is not a list is refused, naming `setting.key`.
 */
export function stringList(
  snap: Record<string, unknown>,
  key: string,
  setting: string,
) {
  const value = snap[key]
  const list =
    value === ''
      ? []
      : typeof value === 'string' || typeof value === 'number'
        ? [value]
        : value
  if (list !== undefined && !Array.isArray(list)) {
    throw new Error(`${setting}.${key} is a list`)
  }
  return Array.isArray(list) ? { [key]: list.map(String) } : {}
}

/**
 * #config RowArrangement
 * #category display
 * The `rows` setting of a display whose rows are not the values of a field:
 * the MAF display's species rows. It holds the arrangement a reader gives the
 * rows, which every product writes as a session edit to this object: the
 * order, the labels, the pinned colors, the tree and the focus, each by row
 * name; beside them `color`, the rows colored by an attribute, and `axis`,
 * the guide that draws the tree and the names. Writing it changes only the
 * members stated. [Rows](../rows) is this plus the `field` whose values each
 * take a row.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMafDisplay',
 *   rows: { sort: ['mm10', 'hg38'], labels: { mm10: 'Mouse' }, axis: { tree: false } },
 * }
 * ```
 */
export const rowArrangementConfigSchema = ConfigurationSchema(
  'RowArrangement',
  {
    /**
     * #slot sort
     * The row order, as Vega-Lite's `sort` lists it: the rows listed lead, in
     * this order, and none is dropped. The rest keep the
     * order their source lists them in (a VCF's samples, a multi-BigWig's
     * subtracks), or sort, digits by magnitude, where the rows are values
     * found on features. A clustering run, the arrangement dialog and
     * "Sort rows here" all write it, and a run rotates its dendrogram towards
     * it rather than discarding it.
     */
    sort: {
      type: 'stringArray',
      defaultValue: [],
      description:
        "the row order: the rows listed lead, in this order; the rest keep their source's order (a VCF's samples, a multi-BigWig's subtracks), or sort where the rows are values found on features",
    },
    /**
     * #slot labels
     * A label drawn beside a row in place of its name, by name. Whether any
     * label draws is `rows.axis.labels`.
     */
    labels: {
      type: 'stringMap',
      defaultValue: {},
      description:
        'a label drawn beside a row in place of its name, by name; rows.axis.labels says whether labels draw',
    },
    /**
     * #slot tree
     * The dendrogram beside the rows, a [RowTree](../rowtree): newick, or
     * `{ newick, provenance }` where a clustering run wrote it beside the
     * order it produced. A reorder that moves a row drops it. Whether it
     * draws is `rows.axis.tree`. The rows follow the tree's leaves, then
     * `rows.sort` for any rows the tree lacks; a supplied tree rotates
     * towards `rows.sort`, so a `sort` also decides which way each clade
     * faces.
     */
    tree: rowTreeConfigSchema,
    /**
     * #slot colors
     * A color pinned on a row, by name, over whatever `rows.color` maps it
     * to, as `labels` pins its text: ggplot2's
     * `scale_*_manual(values = c(name = ...))`. The arrangement dialog's row
     * swatches write it. A row with none takes `rows.color`, else the file's
     * own color (MAF's `samples[].color`, a listed source's color), else the
     * palette where the rows share one panel.
     */
    colors: {
      type: 'stringMap',
      defaultValue: {},
      description:
        "a color pinned on a row, by name, over the color rows.color maps it to; a row with none takes rows.color, else the file's own color",
    },
    /**
     * #slot color
     * The rows colored by an attribute: a [RowColor](../rowcolor) channel
     * from a row field through a scale, `name` (each row) by default. Per-row
     * colors are `rows.colors`, which win over it.
     */
    color: rowColorConfigSchema,
    /**
     * #slot annotations
     * Extra color columns beside the row labels, one per row attribute, as
     * ggtree's `gheatmap` and ComplexHeatmap's row annotation draw them: a
     * list of [RowColor](../rowcolor) channels, each a field or
     * `{ field, scale: { domain, range, unknown } }`, drawn in the order
     * listed after the row's own color. Categorical only: each value of the
     * field takes a color the way `rows.color` deals one, a row with no
     * value leaves a gap, a field no row carries draws nothing, and each
     * column gets a key. It reorders no row, so under one tree several
     * attributes read against the same clusters. Like `color` it names no
     * row: "Reset row order" and a write changing `field` keep it.
     */
    annotations: types.array(rowColorConfigSchema),
    /**
     * #slot axis
     * The guide down the left of the rows, a [RowAxis](../rowaxis): whether
     * the tree and the row names draw, and the sidebar's width. What it draws
     * is `rows.tree` and `rows.labels`.
     */
    axis: rowAxisConfigSchema,
    /**
     * #slot kept
     * The rows shown, by name: a clade picked off the tree, or the rows one
     * key row stands for. It narrows the rows to those it names, after
     * `filter` where the display declares one; empty shows every row, and a
     * list naming no current row shows none, with a notice. Keyed: a write
     * changing `field` clears it.
     */
    kept: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'the rows shown, by name, narrowing the rows to those it names; empty shows every row, and a list naming no current row shows none',
    },
  },
  {
    closed: true,
    plot: true,
    misnamed: { treeProvenance: 'tree.provenance' },
    preProcessSnapshot: (snap = {}) => ({
      ...snap,
      ...stringList(snap, 'sort', 'rows'),
      ...stringList(snap, 'kept', 'rows'),
    }),
  },
)
