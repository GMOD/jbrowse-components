import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { defaultFilterFlags } from '../shared/util.ts'
import { tagFilterConfigSchema } from './tagFilterConfigSchema.ts'

import type { ReadFilter } from '../shared/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

const CATEGORY_FILTERS = ['only', 'exclude'] as const

/**
 * #config ReadFilter
 * #category display
 * Every read filter of the alignments display in one object, its `filter`
 * slot: the SAM flag masks, a read name, the tag filters a read has to pass
 * every one of, and the four read categories, each `only`, `exclude` or
 * unset for unfiltered. The default excludes unmapped, QC-failed and duplicate
 * reads (flag 1540).
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', filter: { flagExclude: 1540, properPairs: 'exclude', split: 'only' } }
 * ```
 * ```js
 * { type: 'LinearAlignmentsDisplay', filter: { tagFilters: [{ tag: 'HP', value: '1' }] } }
 * ```
 */
export const readFilterConfigSchema = ConfigurationSchema(
  'ReadFilter',
  {
    /**
     * #slot
     */
    flagInclude: {
      type: 'number',
      defaultValue: defaultFilterFlags.flagInclude,
      description:
        'a read passes only with every one of these SAM flag bits set, samtools -f',
    },
    /**
     * #slot
     */
    flagExclude: {
      type: 'number',
      defaultValue: defaultFilterFlags.flagExclude,
      description:
        'a read passes only with none of these SAM flag bits set, samtools -F; 1540 drops unmapped, QC-failed and duplicate reads',
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
    tagFilters: types.array(tagFilterConfigSchema),
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
     * `only`, `exclude`, or unset for unfiltered: pairs the aligner flagged proper, in normal orientation.
     */
    properPairs: {
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
  },
  {
    closed: true,
    // a v4 session held one tag filter under the singular name
    retired: {
      tagFilter: (value: unknown) => ({ tagFilters: [value] }),
    },
  },
)

/** The filter as the worker, the menus and the dialog read it, each slot at its default where unset. */
export function readFilterOf(
  filter: Instance<typeof readFilterConfigSchema>,
): ReadFilter {
  return {
    flagInclude: readConfObject(filter, 'flagInclude'),
    flagExclude: readConfObject(filter, 'flagExclude'),
    readName: readConfObject(filter, 'readName'),
    tagFilters: readConfObject(filter, 'tagFilters'),
    spliced: readConfObject(filter, 'spliced'),
    properPairs: readConfObject(filter, 'properPairs'),
    singletons: readConfObject(filter, 'singletons'),
    split: readConfObject(filter, 'split'),
  }
}
