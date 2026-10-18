import {
  ConfigurationSchema,
  getConfigurationSchemaMetadata,
  isBareConfigurationSchemaType,
  readConfObject,
} from '@jbrowse/core/configuration'
import { CATEGORY_FILTERS } from '@jbrowse/display-kit/categoryFilter'
import { types } from '@jbrowse/mobx-state-tree'

import { connectionFilterConfigSchema } from './connectionFilterConfigSchema.ts'
import { junctionFilterConfigSchema } from './junctionFilterConfigSchema.ts'
import { tagFilterConfigSchema } from './tagFilterConfigSchema.ts'

import type { ReadFilter } from '../shared/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config AlignmentsFilter
 * #category display
 * Every test the alignments display applies, in one object, its `filter`
 * slot, read by every part that draws the data a test names. The read members
 * are the SAM flag masks, a minimum mapping quality, a read name, the tags a
 * read has to carry, and the four read categories, each `only`, `exclude` or
 * unset for unfiltered; the default excludes unmapped, QC-failed and duplicate
 * reads (flag 1540). `junctions` tests the splice junctions and `connections`
 * the connections between mates and split segments. Every test must hold, so
 * two categories AND together: `{ split: 'only', svSignal: 'only' }` keeps the
 * split reads alone.
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
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   filter: { junctions: { minReads: 5, nonCanonical: 'exclude' } },
 * }
 * ```
 */
export const alignmentsFilterConfigSchema = ConfigurationSchema(
  'AlignmentsFilter',
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
     * The tags a read has to carry, every one of them: a `{ tag, value }`
     * each, the value `*` or unset passing any read with the tag.
     */
    tags: types.array(tagFilterConfigSchema),
    /**
     * #slot
     * `only`, `exclude`, or unset for unfiltered: reads whose CIGAR carries a reference skip.
     */
    spliced: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description: 'only, exclude, or unset for unfiltered',
    },
    /**
     * #slot
     * `only`, `exclude`, or unset for unfiltered: reads carrying SV evidence, and the rest of their pair in the same displayed region. A read is evidence when it is split, carries an insertion or deletion of 50 bp or more, or is a paired primary read the aligner did not call concordant (no 0x2, a mate unmapped or on another chromosome, or a pair not facing FR). Both ends must be placed: a read at MAPQ 0 carries no evidence, a split read counts only when some other piece in its SA tag has MAPQ above 0, and a discordant read only when its mate does, where the MQ tag records it.
     */
    svSignal: {
      type: 'maybeStringEnum',
      model: types.enumeration('CategoryFilter', [...CATEGORY_FILTERS]),
      description: 'only, exclude, or unset for unfiltered',
    },
    /**
     * #slot
     * `only`, `exclude`, or unset for unfiltered: reads whose mate and supplementary segments are all outside the window.
     */
    singletons: {
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
     * #slot junctions
     * The splice junctions drawn: `minReads` (default 2) and `nonCanonical`.
     */
    junctions: junctionFilterConfigSchema,
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
  alignmentsFilterConfigSchema,
)!

/** The read members' names: every member but the `junctions` and `connections` objects. */
export const readFilterMembers = Object.keys(definition).filter(
  member => !isBareConfigurationSchemaType(definition[member]),
) as (keyof ReadFilter)[]

// Spelled out rather than mapped off `readFilterMembers`, so each read is typed
// against `ReadFilter`; the schema test pins the two lists equal.
/** The read members, as the worker, the menus and the dialog read them, each at its default where unset. */
export function readFilterOf(
  filter: Instance<typeof alignmentsFilterConfigSchema>,
): ReadFilter {
  return {
    flagInclude: readConfObject(filter, 'flagInclude'),
    flagExclude: readConfObject(filter, 'flagExclude'),
    minMapq: readConfObject(filter, 'minMapq'),
    readName: readConfObject(filter, 'readName'),
    tags: readConfObject(filter, 'tags'),
    spliced: readConfObject(filter, 'spliced'),
    svSignal: readConfObject(filter, 'svSignal'),
    singletons: readConfObject(filter, 'singletons'),
    split: readConfObject(filter, 'split'),
  }
}
