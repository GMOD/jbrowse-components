import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { CATEGORY_FILTERS } from './categoryFilters.ts'

/**
 * #config ConnectionFilter
 * #category display
 * The connections between mates and split segments the alignments display
 * draws, its `filter.connections`: two connection categories, each `only`,
 * `exclude` or unset for unfiltered, as a read category is, and the reads an
 * inter-chromosomal breakpoint must gather. Every part that draws connections
 * reads it: the arcs, the read cloud, the connectors over the pileup
 * (`pileup.showConnectors`) and the tables engine's arcs. Which pairs are
 * ordinary is each mark's own test, so `readConnections.showOrdinaryPairs`
 * sits with the band.
 */
export const connectionFilterConfigSchema = ConfigurationSchema(
  'ConnectionFilter',
  {
    /**
     * #slot
     */
    interchrom: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description:
        'only, exclude, or unset for unfiltered: connections to a mate or split segment on another chromosome, an arc or a connector where both chromosomes are displayed and a tick at each breakpoint otherwise',
    },
    /**
     * #slot
     */
    offscreenMates: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description:
        'only, exclude, or unset for unfiltered: connections to a mate or split segment elsewhere on the same chromosome and outside the loaded window, drawn as vertical lines. A connector joins two laid-out reads, so it is never one',
    },
    /**
     * #slot
     */
    minInterchromReads: {
      type: 'number',
      // A literal for the docgen, as junctions' minReads; the menu's reset
      // reads DEFAULT_MIN_INTERCHROM_READS.
      defaultValue: 2,
      description:
        'an inter-chromosomal connection draws only with at least this many reads clustered at its breakpoint, counted over one fragment length on both sides; 1 draws every one, and a split read is exempt',
    },
  },
  { closed: true },
)
