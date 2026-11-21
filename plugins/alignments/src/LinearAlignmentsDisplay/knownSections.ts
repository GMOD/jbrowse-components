import {
  NO_VALUE_LABEL,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'
import { OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
import { knownSectionsOf } from '@jbrowse/display-kit/sectionHost'
import { fieldHeading } from '@jbrowse/display-kit/sectionsHeading'

import { FACET_LABELS, fieldTag } from '../shared/facetLabels.ts'
import { isReadDimension, sectionOrder } from '../shared/groupFeatures.ts'
import { orderedGroups } from './groupedDataMaps.ts'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'
import type { Facet } from '../shared/types.ts'
import type { GroupId } from '@jbrowse/core/util/groupKeys'

/**
 * Every section the Sections dialog lists, in stacking order: each one the
 * fetched regions hold, hidden or not, and each the facet's `sort` or the
 * hidden set names besides. A read dimension keeps the level names its fetch
 * gave; a tag or field value is labelled bare, its field being the column
 * header. The overflow lane is no value of its own, so as its chip offers
 * no hide, it does not list. Empty while ungrouped, chain mode's degraded
 * facet included.
 */
export function knownSections(
  rpcDataMap: ReadonlyMap<number, GroupedAlignmentsResult>,
  facet: Facet | undefined,
  hidden: ReadonlySet<string>,
): GroupId[] {
  if (facet) {
    const { field, sort = [] } = facet
    const compare = sectionOrder(field, sort)
    const fetched = new Map(
      orderedGroups(rpcDataMap, undefined, compare)
        .filter(({ key }) => key !== OVERFLOW_GROUP_KEY)
        .map(({ key, label }) => [key, label]),
    )
    const label = isReadDimension(field)
      ? (key: string) => fetched.get(key) ?? (key === '' ? NO_VALUE_LABEL : key)
      : categoricalField(fieldTag(field) ?? field).label
    return knownSectionsOf(fetched.keys(), { compare, label }, [
      ...sort,
      ...hidden,
    ])
  } else {
    return []
  }
}

/** The Sections dialog's column header for a facet on `field`. */
export function sectionsHeadingOf(field = '') {
  return isReadDimension(field)
    ? FACET_LABELS[field]
    : (fieldTag(field) ?? fieldHeading(field))
}
