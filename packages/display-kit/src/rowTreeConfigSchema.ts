import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config RowTree
 * #category display
 * `rows.tree`, the dendrogram beside the rows: its newick, and where a
 * clustering run computed it, the locus and settings it ran with. A string is
 * the newick. The provenance is keyed by the newick, as `rows.sort` is by
 * `rows.field`: a write of another newick, as a member or whole, drops the
 * provenance it does not state, so a provenance only ever describes the tree
 * beside it. A plot read gives the object whichever form was written.
 * Whether it draws is `rows.axis.tree`.
 *
 * #example
 * ```js
 * { type: 'LinearVariantDisplay', rows: { tree: '((HG002,HG003),HG004);' } }
 * ```
 */
export const rowTreeConfigSchema = ConfigurationSchema(
  'RowTree',
  {
    /**
     * #slot newick
     * The tree as newick, its leaves the row names. Writing
     * `rows.tree: "(a,b);"` sets this slot.
     */
    newick: {
      type: 'maybeString',
      description: 'the tree as newick, its leaves the row names',
    },
    /**
     * #slot provenance
     * The locus and settings a clustering run computed the tree from; unset
     * for a tree that arrived as data, which rotates towards `rows.sort`. A
     * write of another `newick` drops it unless it states one.
     */
    provenance: {
      type: 'maybeFrozen',
      description:
        'the locus and settings a clustering run computed the tree from; unset for a tree that arrived as data',
    },
  },
  {
    shorthand: 'newick',
    writes: { keyedBy: 'newick', keyed: ['provenance'] },
    closed: true,
  },
)
