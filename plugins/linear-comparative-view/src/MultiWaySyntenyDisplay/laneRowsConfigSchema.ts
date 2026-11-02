import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  ROW_ARRANGEMENT_WRITES,
  rowArrangementConfigSchema,
} from '@jbrowse/display-kit/rowArrangementConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #config LaneRows
 * #category display
 * The multi-way synteny display's `rows`: one lane per assembly below the
 * anchor, so `assembly` is the one field, and the object is the arrangement a
 * reader gives the lanes, and writing it changes only the members stated. `sort`
 * lists the lanes that stack first, in order, the rest following densest-first
 * so a ribbon chain through adjacent lanes is cut as late as possible; `kept`
 * names the lanes drawn, empty drawing the track's lanes or every lane.
 * Haplotype lanes read off a graph follow by structure instead, below any
 * lanes `sort` pins, so lanes whose deletions and insertions against the
 * anchor match sit together, in an order worked out once per window.
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
    /**
     * #slot field
     * `assembly`, the one field a lane can be.
     */
    field: {
      type: 'stringEnum',
      model: types.enumeration('LaneRowsField', ['assembly']),
      defaultValue: 'assembly',
      description: 'assembly, the one field a lane can be',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: rowArrangementConfigSchema,
    shorthand: 'field',
    writes: ROW_ARRANGEMENT_WRITES,
    plot: true,
  },
)
