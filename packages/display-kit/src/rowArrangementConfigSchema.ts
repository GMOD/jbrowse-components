import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { rowTreeConfigSchema } from './rowTreeConfigSchema.ts'

/** The members a reader's arrangement writes, every one a config member. */
export const ROW_ARRANGEMENT_MEMBERS = [
  'sort',
  'labels',
  'tree',
  'kept',
] as const

/** How a bare arrangement is written: its members name the values of `field`. */
export const ROW_ARRANGEMENT_WRITES = {
  keyedBy: 'field',
  keyed: ROW_ARRANGEMENT_MEMBERS,
} as const

function stringList(snap: Record<string, unknown>, key: string) {
  const value = snap[key]
  if (value === undefined) {
    return {}
  }
  if (!Array.isArray(value)) {
    throw new Error(`rows.${key} is a list`)
  }
  return { [key]: value.map(String) }
}

/**
 * #config RowArrangement
 * #category display
 * The `rows` setting of a display whose rows are samples or species rather
 * than the values of a field. It holds the arrangement a reader gives the
 * rows, which every product writes as a session edit to this object: the
 * order, the labels, the tree and the focus, each by row name. The
 * field-keyed displays' `Rows` object is this plus `field`.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearVariantDisplay',
 *   rows: { sort: ['NA12878', 'NA12891'], labels: { NA12878: 'Proband' } },
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
     * draws is `rows.axis.tree`.
     */
    tree: rowTreeConfigSchema,
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
    misnamed: { treeProvenance: 'tree.provenance' },
    preProcessSnapshot: (snap = {}) => ({
      ...snap,
      ...stringList(snap, 'sort'),
      ...stringList(snap, 'kept'),
    }),
  },
)
