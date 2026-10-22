import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import {
  SORT_FIELDS,
  isColumnSortField,
  isLayoutOrder,
  isTagSortField,
} from '../shared/types.ts'

import type { LayoutOrder, SortColumn } from '../shared/types.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Named, so the JSON schema states it as the `tags.XX` pattern
// (scripts/configJsonSchema.ts) as it states a CSS color.
const SamTagField = types.refinement(
  'SamTagField',
  types.string,
  isTagSortField,
  value =>
    `${JSON.stringify(value)} is none of ${SORT_FIELDS.join(', ')}, and no SAM tag field (tags.XX)`,
)

/**
 * #config AlignmentsSort
 * #category display
 * The alignments displays' `sort` setting: the pileup's row order, by the
 * `field` it ranks the reads on. A whole-window order is a string —
 * `"position"` (by start, the default), `"length"` (widest first), `"spliced"`
 * (reads whose CIGAR has a skip first), `"split"` (reads aligned in pieces
 * first) or `"svSignal"` (the structural-variant evidence first, in tiers:
 * split reads, then reads with an insertion or deletion of 50 bp or more, then
 * paired reads the aligner did not call concordant, each with both ends placed
 * above MAPQ 0, as the `svSignal` filter counts it). A column sort ranks the
 * reads over one base, `pos` (0-based) on `refName`, by `strand`, `base`,
 * `mapq` (highest first), `pairOrientation` (the abnormal orientations over
 * LR), a SAM tag (`tags.HP`, spelt as `encoding.color` and `facet` spell one), or the
 * `insertion`, `softclip` or `hardclip` there, or up to `within` bases either
 * side; the reads not over it lay out by position. On another chromosome a
 * column sort orders by position.
 *
 * #example
 * ```js
 * { type: 'LinearAlignmentsDisplay', sort: 'spliced' }
 * ```
 * ```js
 * {
 *   type: 'LinearAlignmentsDisplay',
 *   sort: { field: 'tags.HP', pos: 1999, refName: 'ctgA' },
 * }
 * ```
 */
export const alignmentsSortConfigSchema = ConfigurationSchema(
  'AlignmentsSort',
  {
    /**
     * #slot field
     */
    field: {
      type: 'string',
      model: types.union(
        types.enumeration('AlignmentsSortField', [...SORT_FIELDS]),
        SamTagField,
      ),
      defaultValue: 'position',
      description:
        'position, length, spliced, split or svSignal order the whole window; strand, base, mapq, pairOrientation, a tags.XX tag, insertion, softclip or hardclip rank the reads over the column at pos',
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
     * #slot within
     */
    within: {
      type: 'maybeNumber',
      description:
        'how many bases either side of pos an insertion, softclip or hardclip sort still ranks a mark',
    },
  },
  {
    shorthand: 'field',
    writes: 'whole',
    closed: true,
    plot: true,
  },
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
  const field: string = readConfObject(sort, 'field')
  const pos: number | undefined = readConfObject(sort, 'pos')
  const refName: string | undefined =
    readConfObject(sort, 'refName') ?? fallbackRefName
  return isLayoutOrder(field)
    ? { layoutOrder: field, sortColumn: undefined }
    : {
        layoutOrder: 'position',
        sortColumn:
          pos === undefined ||
          refName === undefined ||
          !isColumnSortField(field)
            ? undefined
            : {
                field,
                pos,
                refName: canonical(refName),
                within: readConfObject(sort, 'within'),
              },
      }
}
