import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { stringList } from '@jbrowse/display-kit/rowArrangementConfigSchema'

/**
 * #config LaneRows
 * #category display
 * The multi-way synteny display's `rows`: one lane per assembly below the
 * anchor, so a lane is always an assembly and the object takes no `field`. It
 * is the arrangement a reader gives the lanes, by assembly name, and writing
 * it changes only the members stated. `sort`
 * lists the lanes that stack first, in order, the rest following densest-first
 * so a ribbon chain through adjacent lanes is cut as late as possible; `kept`
 * names the lanes drawn, empty drawing the track's lanes or every lane.
 * Haplotype lanes read off a graph follow by structure instead, below any
 * lanes `sort` pins, so lanes whose deletions and insertions against the
 * anchor match sit together, in an order worked out once per window. Lanes
 * take no tree.
 *
 * #example
 * ```js
 * {
 *   type: 'MultiWaySyntenyDisplay',
 *   rows: { sort: ['GCF_000346465.2', 'poplar'], kept: ['GCF_000346465.2', 'poplar', 'citrus'] },
 * }
 * ```
 */
export const laneRowsConfigSchema = ConfigurationSchema(
  'LaneRows',
  {
    /**
     * #slot sort
     * The lanes that stack first, by assembly name, in this order; the rest
     * follow densest-first.
     */
    sort: {
      type: 'stringArray',
      defaultValue: [],
      description:
        'the lanes that stack first, by assembly name, in this order; the rest follow densest-first',
    },
    /**
     * #slot labels
     * A label drawn for a lane in place of its assembly name, by assembly
     * name. Where the lane labels draw is `labels.lanes`.
     */
    labels: {
      type: 'stringMap',
      defaultValue: {},
      description:
        'a label drawn for a lane in place of its assembly name, by assembly name; labels.lanes says where lane labels draw',
    },
    /**
     * #slot kept
     * The lanes drawn, by assembly name: it selects rather than narrows,
     * replacing the track's lanes and able to add a lane the track does not
     * configure. Empty draws the track's lanes, or every lane where it
     * configures none.
     */
    kept: {
      type: 'stringArray',
      defaultValue: [],
      description:
        "the lanes drawn, by assembly name, selecting rather than narrowing: it replaces the track's lanes and can add one; empty draws the track's lanes, or every lane",
    },
  },
  {
    closed: true,
    plot: true,
    preProcessSnapshot: (snap = {}) => ({
      ...snap,
      ...stringList(snap, 'sort', 'rows'),
      ...stringList(snap, 'kept', 'rows'),
    }),
  },
)
