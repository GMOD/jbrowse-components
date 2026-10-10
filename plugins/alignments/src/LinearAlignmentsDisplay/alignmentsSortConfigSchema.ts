import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { SORT_TYPES } from '../shared/types.ts'

/**
 * #config AlignmentsSort
 * #category display
 * The alignments displays' `sort` setting: the pileup's row order. A
 * whole-window order is a string — `"position"` (by start, the default),
 * `"length"` (widest first), `"spliced"` (reads whose CIGAR carries a skip
 * first) or `"split"` (reads aligned in pieces, or carrying a deletion of 50 bp
 * or more, first). A column sort ranks the reads over one base, `pos` (0-based)
 * on `refName`, by `strand`, `basePair`, `tag` (naming `tag`), or the
 * `insertion`, `softclip` or `hardclip` there; the reads not over it lay out by
 * position. On another chromosome a column sort orders by position.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', sort: 'spliced' }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   sort: { type: 'tag', tag: 'HP', pos: 1999, refName: 'ctgA' },
 * }
 * ```
 */
export const alignmentsSortConfigSchema = ConfigurationSchema(
  'AlignmentsSort',
  {
    /**
     * #slot type
     */
    type: {
      type: 'stringEnum',
      model: types.enumeration('AlignmentsSortType', [...SORT_TYPES]),
      defaultValue: 'position',
      description:
        'position, length, spliced or split order the whole window; strand, basePair, tag, insertion, softclip or hardclip rank the reads over the column at pos',
    },
    /**
     * #slot pos
     */
    pos: {
      type: 'maybeNumber',
      description: "a column sort's 0-based position",
    },
    /**
     * #slot refName
     */
    refName: {
      type: 'maybeString',
      description: "a column sort's reference sequence",
    },
    /**
     * #slot tag
     */
    tag: {
      type: 'maybeString',
      description: 'the SAM tag a tag sort ranks by',
    },
  },
  { shorthand: 'type', closed: true },
)
