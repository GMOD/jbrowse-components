import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { SORT_TYPES, isLayoutOrder } from '../shared/types.ts'

import type { LayoutOrder, SortColumn, SortType } from '../shared/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config AlignmentsSort
 * #category display
 * The alignments displays' `sort` setting: the pileup's row order. A
 * whole-window order is a string — `"position"` (by start, the default),
 * `"length"` (widest first), `"spliced"` (reads whose CIGAR carries a skip
 * first), `"split"` (reads aligned in pieces first) or `"svSignal"` (split
 * reads and reads carrying a deletion of 50 bp or more first, the evidence for
 * a structural variant). A column sort ranks the reads over one base, `pos`
 * (0-based) on `refName`, by `strand`, `basePair`, `mapq` (highest first),
 * `pairOrientation` (the abnormal orientations over LR), `tag` (naming `tag`),
 * or the `insertion`, `softclip` or `hardclip` there, or up to `within` bases
 * either side; the reads not over it lay out by position. On another
 * chromosome a column sort orders by position.
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
        'position, length, spliced, split or svSignal order the whole window; strand, basePair, mapq, pairOrientation, tag, insertion, softclip or hardclip rank the reads over the column at pos',
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
    /**
     * #slot within
     */
    within: {
      type: 'maybeNumber',
      description:
        'how many bases either side of pos an insertion, softclip or hardclip sort still ranks a mark',
    },
  },
  { shorthand: 'type', closed: true },
)

/**
 * The `sort` object as the layout reads it: the whole-window order, `position`
 * under a column sort, and the column on the refName `canonical` resolves, so
 * an alias written in a spec meets the region's own spelling. A column missing
 * `pos`, or missing `refName` where no `fallbackRefName` stands in, is no sort.
 */
export function sortOf(
  sort: Instance<typeof alignmentsSortConfigSchema>,
  canonical: (refName: string) => string,
  fallbackRefName?: string,
): { layoutOrder: LayoutOrder; sortColumn: SortColumn | undefined } {
  const type: SortType = readConfObject(sort, 'type')
  const pos: number | undefined = readConfObject(sort, 'pos')
  const refName: string | undefined =
    readConfObject(sort, 'refName') ?? fallbackRefName
  return isLayoutOrder(type)
    ? { layoutOrder: type, sortColumn: undefined }
    : {
        layoutOrder: 'position',
        sortColumn:
          pos === undefined || refName === undefined
            ? undefined
            : {
                type,
                pos,
                refName: canonical(refName),
                tag: readConfObject(sort, 'tag'),
                within: readConfObject(sort, 'within'),
              },
      }
}
