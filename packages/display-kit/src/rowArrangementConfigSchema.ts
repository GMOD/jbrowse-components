import { ConfigurationSchema } from '@jbrowse/core/configuration'

/** The members a reader's arrangement writes, every one a config member. */
export const ROW_ARRANGEMENT_MEMBERS = [
  'domain',
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
 * The `rows` setting of a display whose rows are its own — a sample, a
 * species — rather than the values of a field: the arrangement a reader gives
 * them, which every product writes as a session edit to this object. The
 * order, the labels, the tree with its provenance and the focus, each by row
 * name. The field-keyed displays' `Rows` object is this plus `field`.
 *
 * #example
 * ```js
 * {
 *   type: 'LinearMultiSampleVariantDisplay',
 *   rows: { domain: ['NA12878', 'NA12891'], labels: { NA12878: 'Proband' } },
 * }
 * ```
 */
export const rowArrangementConfigSchema = ConfigurationSchema(
  'RowArrangement',
  {
    /**
     * #slot domain
     * The row order: the rows listed lead, in this order, and the rest keep
     * the order they arrived in. A clustering run, the arrangement dialog and
     * "Sort rows here" all write it, and a run rotates its dendrogram towards
     * it rather than discarding it.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'the row order: the rows listed lead, in this order, and the rest keep the order they arrived in',
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
     * What `tree` was computed from, the locus and the settings; unset for a
     * tree that arrived as data.
     */
    treeProvenance: {
      type: 'maybeFrozen',
      description:
        'what tree was computed from, the locus and the settings; unset for a tree that arrived as data',
    },
    /**
     * #slot kept
     * The rows shown, by name: a clade picked off the tree, or the rows one
     * key row stands for. Empty, or naming no current row, shows every row.
     */
    kept: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'the rows shown, by name; empty, or naming no current row, shows every row',
    },
  },
  {
    closed: true,
    preProcessSnapshot: (snap = {}) => ({
      ...snap,
      ...stringList(snap, 'domain'),
      ...stringList(snap, 'kept'),
    }),
  },
)
