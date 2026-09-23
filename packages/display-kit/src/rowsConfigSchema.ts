import { ConfigurationSchema } from '@jbrowse/core/configuration'

/** The `rows` object as read: the field, and the row order. */
export interface RowsSetting {
  field: string
  domain: readonly string[]
}

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
 * #config Rows
 * #category display
 * The `rows` setting of the displays that draw one row per value of a key,
 * with the dendrogram sidebar beside them: the field, and the arrangement a
 * reader gives the rows, which every product writes as a session edit to this
 * object. A string is the field; the object adds the order, the labels, the
 * tree with its provenance and the focus.
 *
 * #example
 * ```js
 * { type: 'LinearWiggleDisplay', rows: 'source' }
 * ```
 * ```js
 * {
 *   type: 'LinearWiggleDisplay',
 *   rows: { field: 'source', domain: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
 * }
 * ```
 */
export const rowsConfigSchema = ConfigurationSchema(
  'Rows',
  {
    /**
     * #slot field
     * The field each value of which takes a row of its own. Writing
     * `rows: "source"` lands here; empty draws no rows.
     */
    field: {
      type: 'featureField',
      defaultValue: '',
      description: 'the field each value of which takes a row of its own',
    },
    /**
     * #slot domain
     * The row order: the values listed lead, in this order, and the rest keep
     * the order they arrived in. A clustering run, the arrangement dialog and
     * "Sort rows here" all write it, and a run rotates its dendrogram towards
     * it rather than discarding it.
     */
    domain: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'the row order: the values listed lead, in this order, and the rest keep the order they arrived in',
    },
    /**
     * #slot labels
     * A label drawn beside a row in place of its value, by value.
     */
    labels: {
      type: 'stringMap',
      defaultValue: {},
      description: 'a label drawn beside a row in place of its value, by value',
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
     * The rows shown, by value: a clade picked off the tree, or the rows one
     * key row stands for. Empty, or naming no current row, shows every row.
     */
    kept: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'the rows shown, by value; empty, or naming no current row, shows every row',
    },
  },
  {
    shorthand: 'field',
    closed: true,
    preProcessSnapshot: (snap = {}) => ({
      ...snap,
      ...stringList(snap, 'domain'),
      ...stringList(snap, 'kept'),
    }),
  },
)

/** The rows as read back: undefined while nothing is on rows. */
export function rowsSettingOf(snapshot: {
  field: string
  domain: readonly string[]
}): RowsSetting | undefined {
  return snapshot.field
    ? { field: snapshot.field, domain: snapshot.domain }
    : undefined
}
