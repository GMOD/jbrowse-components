import { capitalizeFirst, coarseStripHTML } from '@jbrowse/core/util'

export interface RowFields {
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface Row extends RowFields {
  id: string
}

const METADATA_PREFIX = 'metadata.'

// A facet field id is either a top-level row key ('category') or a
// metadata-prefixed key ('metadata.assay'); this strips the prefix to the bare
// key name (used for column headers).
function bareFacet(facet: string) {
  return facet.startsWith(METADATA_PREFIX)
    ? facet.slice(METADATA_PREFIX.length)
    : facet
}

export function isMetadataFacet(facet: string) {
  return facet.startsWith(METADATA_PREFIX)
}

export function metadataFacet(key: string) {
  return `${METADATA_PREFIX}${key}`
}

export function getRowStr(facet: string, row: RowFields) {
  return `${
    (isMetadataFacet(facet) ? row.metadata?.[bareFacet(facet)] : row[facet]) ??
    ''
  }`
}

// Display label for a facet, shared by the grid column headers, the filter
// chips and the Manage-columns menu. Strips the metadata prefix and
// capitalizes the first letter, so built-in fields read like a hub's keys,
// disambiguating a metadata key that collides with a non-metadata column as
// "x (from metadata)". Markup is stripped rather than rendered: every consumer
// is a text-only context (a menu item label, a truncating header cell).
export function facetLabel(facet: string, nonMetadataFieldSet: Set<string>) {
  const bare = capitalizeFirst(coarseStripHTML(bareFacet(facet)))
  return isMetadataFacet(facet) &&
    nonMetadataFieldSet.has(coarseStripHTML(bareFacet(facet)))
    ? `${bare} (from metadata)`
    : bare
}

export const noMatchingTracksMessage =
  'No tracks match the current search and filters'
