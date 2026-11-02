import { ConfigurationSchema } from '@jbrowse/core/configuration'

/**
 * #config RowAxis
 * #category display
 * `rows.axis`: the guide down the left of a row display, which draws the
 * clustering tree and the row names. A guide nests under its channel
 * (ADR-257), as the value axis is `encoding.y.axis`: `rows` holds what the
 * axis draws (`rows.tree`, `rows.labels`), and `rows.axis` whether and how
 * it draws them. The wiggle, variant and mark displays add `grid`
 * ([RowAxisWithGrid](../rowaxiswithgrid)).
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', rows: { axis: { tree: false, width: 120 } } }
 * ```
 */
export const rowAxisConfigSchema = ConfigurationSchema(
  'RowAxis',
  {
    /**
     * #slot
     * Whether the tree draws; the tree itself is `rows.tree`.
     */
    tree: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the clustering tree in the sidebar; rows.tree is the tree itself',
    },
    /**
     * #slot
     */
    branchLength: {
      type: 'boolean',
      defaultValue: true,
      description:
        'position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram)',
    },
    /**
     * #slot
     * The names draw over the plot, in a strip as wide as the widest name up
     * to 120px, so on a wide view the left of every row sits under them. The
     * text a row's label takes is `rows.labels`.
     */
    labels: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw each row’s name over the left of the plot; rows.labels gives a row another label',
    },
    /**
     * #slot
     * A drag on the sidebar's edge writes this, as a drag on the track's
     * bottom edge writes `height`.
     */
    width: {
      type: 'number',
      defaultValue: 80,
      description:
        'width in px of the tree sidebar, which a drag on its edge also writes',
    },
  },
  { closed: true },
)
