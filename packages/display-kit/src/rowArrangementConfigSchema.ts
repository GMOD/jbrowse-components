import { ConfigurationSchema } from '@jbrowse/core/configuration'

/** The members a reader's arrangement writes, every one a config member. */
export const ROW_ARRANGEMENT_MEMBERS = [
  'sort',
  'labels',
  'tree',
  'treeProvenance',
  'kept',
] as const

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
 * order, the labels, the tree with its provenance and the focus, each by row
 * name. The field-keyed displays' `Rows` object is this plus `field`.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMultiSampleVariantDisplay',
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
     * A label drawn beside a row in place of its name, by name.
     */
    labels: {
      type: 'stringMap',
      defaultValue: {},
      description: 'a label drawn beside a row in place of its name, by name',
    },
    /**
     * #slot tree
     * The dendrogram beside the rows, as newick. A clustering run writes it
     * beside the order it produced, and a reorder that moves a row drops it.
     */
    tree: {
      type: 'maybeString',
      description:
        'the dendrogram beside the rows, as newick, written by a clustering run beside the order it produced',
    },
    /**
     * #slot treeProvenance
     * The locus and settings `tree` was computed from; unset for a tree that
     * arrived as data. A clustering run writes it with `tree`; a config
     * copies the two together or leaves both out.
     */
    treeProvenance: {
      type: 'maybeFrozen',
      description:
        'the locus and settings the tree was computed from; unset for a tree that arrived as data',
    },
    /**
     * #slot kept
     * The rows shown, by name: a clade picked off the tree, or the rows one
     * key row stands for. Empty shows every row, and so does naming no current
     * row where the track lists its rows.
     */
    kept: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'the rows shown, by name; empty shows every row, and so does naming no current row where the track lists its rows',
    },
  },
  {
    closed: true,
    preProcessSnapshot: (snap = {}) => ({
      ...snap,
      ...stringList(snap, 'sort'),
      ...stringList(snap, 'kept'),
    }),
  },
)
