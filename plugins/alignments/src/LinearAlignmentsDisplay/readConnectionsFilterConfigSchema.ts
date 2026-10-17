import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { CATEGORY_FILTERS } from './readFilterConfigSchema.ts'

/**
 * #config ReadConnectionsFilter
 * #category display
 * The connections the arcs and the read cloud draw, the alignments display's
 * `readConnections.filter`: two connection categories, each `only`,
 * `exclude` or unset for unfiltered, as a read category is in `filter`, and
 * the reads an inter-chromosomal breakpoint must gather. Which pairs are
 * ordinary is each mark's own test, so `showOrdinaryPairs` sits beside
 * `mark` rather than here.
 */
export const readConnectionsFilterConfigSchema = ConfigurationSchema(
  'ReadConnectionsFilter',
  {
    /**
     * #slot
     */
    interchrom: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description:
        'only, exclude, or unset for unfiltered: connections to a mate or split segment on another chromosome, an arc where both chromosomes are displayed and a tick at each breakpoint otherwise',
    },
    /**
     * #slot
     */
    offscreenMates: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description:
        'only, exclude, or unset for unfiltered: connections to a mate or split segment elsewhere on the same chromosome and outside the loaded window, drawn as vertical lines',
    },
    /**
     * #slot
     */
    minInterchromReads: {
      type: 'number',
      // A literal for the docgen, as sashimi's minReads; the menu's reset
      // reads DEFAULT_MIN_INTERCHROM_READS.
      defaultValue: 2,
      description:
        'an inter-chromosomal connection draws only with at least this many reads clustered at its breakpoint, counted over one fragment length on both sides; 1 draws every one, and a split read is exempt',
    },
  },
  { closed: true },
)
