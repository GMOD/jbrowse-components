import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { CATEGORY_FILTERS } from './readFilterConfigSchema.ts'

/**
 * #config SashimiFilter
 * #category display
 * The junctions the sashimi arcs draw, the alignments display's
 * `sashimi.filter`: a supporting-read floor, and the non-canonical junctions
 * as a category, `only`, `exclude` or unset for unfiltered, as a read category
 * is in `filter`.
 */
export const sashimiFilterConfigSchema = ConfigurationSchema(
  'SashimiFilter',
  {
    /**
     * #slot
     */
    minReads: {
      type: 'number',
      // The config docgen renders a default off its source text, so this is a
      // literal; DEFAULT_MIN_SASHIMI_READS spells the same number for the menu.
      defaultValue: 2,
      description:
        'a junction draws only with at least this many supporting reads; 1 draws every junction',
    },
    /**
     * #slot
     */
    nonCanonical: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description:
        'only, exclude, or unset for unfiltered: junctions whose splice motif is none of GT-AG, GC-AG or AT-AC. The motif is read off the reference, so filtering needs a sequence adapter, and a junction whose motif could not be read counts as canonical',
    },
  },
  { closed: true },
)
