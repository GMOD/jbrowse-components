import {
  NO_VALUE_LABEL,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'
import { OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
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
  if (!facet) {
    return []
  }
  const compare = sectionOrder(facet.field, facet.sort)
  const valueLabel = isReadDimension(facet.field)
    ? (key: string) => (key === '' ? NO_VALUE_LABEL : key)
    : categoricalField(fieldTag(facet.field) ?? facet.field).label
  const sections = new Map(
    orderedGroups(rpcDataMap, undefined, compare).map(({ key, label }) => [
      key,
      isReadDimension(facet.field) ? label : valueLabel(key),
    ]),
  )
  for (const key of [...(facet.sort ?? []), ...hidden]) {
    if (!sections.has(key)) {
      sections.set(key, valueLabel(key))
    }
  }
  sections.delete(OVERFLOW_GROUP_KEY)
  return [...sections]
    .sort(([a], [b]) => compare(a, b))
    .map(([key, label]) => ({ key, label }))
}

/** The Sections dialog's column header for a facet on `field`. */
export function sectionsHeadingOf(field = '') {
  return isReadDimension(field)
    ? FACET_LABELS[field]
    : (fieldTag(field) ?? fieldHeading(field))
}
