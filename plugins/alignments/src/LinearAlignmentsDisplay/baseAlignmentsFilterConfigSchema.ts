import {
  ConfigurationSchema,
  getConfigurationSchemaMetadata,
  isBareConfigurationSchemaType,
  readConfObject,
} from '@jbrowse/core/configuration'
import { CATEGORY_FILTERS } from '@jbrowse/display-kit/categoryFilter'
import { types } from '@jbrowse/mobx-state-tree'

import { connectionFilterConfigSchema } from './connectionFilterConfigSchema.ts'
import { tagFilterConfigSchema } from './tagFilterConfigSchema.ts'

import type { ReadFilter } from '../shared/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config BaseAlignmentsFilter
 * #category display
 * The `filter` both alignments-shaped displays read, LinearAlignmentsDisplay
 * and LGVSyntenyDisplay. The read members are the SAM flag masks, a minimum
 * mapping quality, a read name, the tags a read must have, and the four
 * read categories, each `only`, `exclude` or unset for unfiltered; the default
 * excludes unmapped, QC-failed and duplicate reads (flag 1540). `connections`
 * tests the connections between mates and split segments. Every test must
 * hold, so two categories both apply: `{ split: 'only', svSignal: 'only' }`
 * keeps the split reads alone.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', filter: { svSignal: 'only' } }
 * ```
 * ```js
 * { type: 'LinearAlignmentsDisplay', filter: { minMapq: 20 } }
 * ```
 * ```js
 * { type: 'LinearAlignmentsDisplay', filter: { tags: [{ tag: 'HP', value: '1' }] } }
 * ```
 */
export const baseAlignmentsFilterConfigSchema = ConfigurationSchema(
  'BaseAlignmentsFilter',
  {
    /**
     * #slot
     */
    flagInclude: {
      type: 'number',
      // A literal, as the config docgen prints the source text;
      // configDefaultParity.test.ts holds it to `defaultFilterFlags`.
      defaultValue: 0,
      description:
        'a read passes only with every one of these SAM flag bits set, samtools -f',
    },
    /**
     * #slot
     */
    flagExclude: {
      type: 'number',
      defaultValue: 1540,
      description:
        'a read passes only with none of these SAM flag bits set, samtools -F; 1540 drops unmapped, QC-failed and duplicate reads',
    },
    /**
     * #slot
     */
    minMapq: {
      type: 'maybeNumber',
      description:
        'a read passes only with a mapping quality of at least this; a read whose mapping quality is unavailable (255) fails it. Unset passes every read',
    },
    /**
     * #slot
     */
    readName: {
      type: 'maybeString',
      description: 'the one read name shown; unset shows every read',
    },
    /**
     * #slot
     * The tags a read must have, every one of them: a `{ tag, value }`
     * each, and an unset value matches any read with the tag.
     */
    tags: types.array(tagFilterConfigSchema),
    /**
     * #slot
     * `only`, `exclude`, or unset for unfiltered: reads whose CIGAR has a reference skip.
     */
    spliced: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description: 'only, exclude, or unset for unfiltered',
    },
    /**
     * #slot
     * `only`, `exclude`, or unset for unfiltered: reads with SV evidence, and the rest of their pair in the same displayed region. A read is evidence when it is split, has an insertion or deletion of 50 bp or more, or is a paired primary read the aligner did not call concordant (no 0x2, a mate unmapped or on another chromosome, or a pair not facing FR). Both ends must be placed: a read at MAPQ 0 is not evidence, a split read counts only when some other piece in its SA tag has MAPQ above 0, and a discordant read only when its mate does, as the MQ tag records.
     */
    svSignal: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description: 'only, exclude, or unset for unfiltered',
    },
    /**
     * #slot
     * `only`, `exclude`, or unset for unfiltered: reads with no other alignment of themselves in the window, no mate and no split or supplementary segment there. A mate unmapped, on another chromosome or outside the window counts, as does a single-end read with no SA tag.
     */
    alone: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description: 'only, exclude, or unset for unfiltered',
    },
    /**
     * #slot
     * `only`, `exclude`, or unset for unfiltered: reads with a supplementary segment, a chimeric alignment.
     */
    split: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description: 'only, exclude, or unset for unfiltered',
    },
    /**
     * #slot connections
     * The connections drawn: `interchrom`, `offscreenMates` and
     * `minInterchromReads` (default 2).
     */
    connections: connectionFilterConfigSchema,
  },
  {
    closed: true,
    plot: true,
    // a v4 session held one tag filter under the singular name
    retired: {
      tagFilter: (value: unknown) => ({ tags: [value] }),
    },
  },
)

const { definition } = getConfigurationSchemaMetadata(
  baseAlignmentsFilterConfigSchema,
)!

/** The read members' names: every member but the `connections` object and, on the alignments display, `junctions`. */
export const readFilterMembers = Object.keys(definition).filter(
  member => !isBareConfigurationSchemaType(definition[member]),
) as (keyof ReadFilter)[]

// Spelled out rather than mapped off `readFilterMembers`, so each read is typed
// against `ReadFilter`; the schema test pins the two lists equal.
/** The read members, as the worker, the menus and the dialog read them, each at its default where unset. */
export function readFilterOf(
  filter: Instance<typeof baseAlignmentsFilterConfigSchema>,
): ReadFilter {
  return {
    flagInclude: readConfObject(filter, 'flagInclude'),
    flagExclude: readConfObject(filter, 'flagExclude'),
    minMapq: readConfObject(filter, 'minMapq'),
    readName: readConfObject(filter, 'readName'),
    tags: readConfObject(filter, 'tags'),
    spliced: readConfObject(filter, 'spliced'),
    svSignal: readConfObject(filter, 'svSignal'),
    alone: readConfObject(filter, 'alone'),
    split: readConfObject(filter, 'split'),
  }
}
