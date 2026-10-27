import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { rowArrangementConfigSchema } from '@jbrowse/display-kit/rowArrangementConfigSchema'
import type { rowColorConfigSchema } from '@jbrowse/display-kit/rowColorConfigSchema'

/**
 * #config RowAxis
 * #category display
 * The `axis` beside `rows`: the guide down the left of a row display, which
 * draws the clustering tree and the row names. `rows` holds what the axis
 * draws (`rows.tree`, `rows.labels`), and `axis` whether and how it draws
 * them. A display's value axis, where it has one, is `encoding.y.axis`. The
 * wiggle, multi-sample variant and multi-row feature displays add `grid`
 * ([RowAxisWithGrid](../rowaxiswithgrid)).
 *
 * #example
 * ```js
 * { type: 'LinearMafDisplay', axis: { tree: false, width: 120 } }
 * ```
 */
export const rowAxisConfigSchema = ConfigurationSchema(
  'RowAxis',
  {
    /**
     * #slot
     */
    tree: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw the clustering tree in the sidebar',
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
     * to 120px, so on a wide view the left of every row sits under them.
     */
    labels: {
      type: 'boolean',
      defaultValue: true,
      description: 'draw each row’s name over the left of the plot',
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

export type TreeSidebarConfigModel = ConfigModelForFields<{
  axis: typeof rowAxisConfigSchema
  rows: typeof rowArrangementConfigSchema
  rowColor: typeof rowColorConfigSchema
}>
