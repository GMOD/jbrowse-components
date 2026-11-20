import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
import { fieldHeading } from '@jbrowse/display-kit/sectionsMenu'

import { FACET_LABELS, fieldTag } from '../shared/facetLabels.ts'
import { isReadDimension, sectionOrder } from '../shared/groupFeatures.ts'
import { orderedGroups } from './groupedDataMaps.ts'

import type { GroupedAlignmentsResult } from '../RenderAlignmentDataRPC/types.ts'
import type { Facet } from '../shared/types.ts'
import type { GroupId } from '@jbrowse/core/util/groupKeys'

/**
 * Every section the Sections dialog lists, in stacking order: each one the
 * fetched regions hold, hidden or not, and each the facet's `sort` or the
 * hidden set names besides. A read dimension keeps its own level names; a
 * tag or field value is labelled bare, its field being the column header.
 * Empty while ungrouped, chain mode's degraded facet included.
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
    ? undefined
    : categoricalField(fieldTag(facet.field) ?? facet.field).label
  const labelOf = (key: string, fetched?: string) =>
    key === OVERFLOW_GROUP_KEY
      ? (fetched ?? key)
      : (valueLabel?.(key) ?? fetched ?? key)
  const sections = new Map(
    orderedGroups(rpcDataMap, undefined, compare).map(({ key, label }) => [
      key,
      labelOf(key, label),
    ]),
  )
  for (const key of [...(facet.sort ?? []), ...hidden]) {
    if (!sections.has(key)) {
      sections.set(key, labelOf(key))
    }
  }
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
