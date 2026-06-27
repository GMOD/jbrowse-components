export interface Row {
  id: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

const METADATA_PREFIX = 'metadata.'

// A facet field id is either a top-level row key ('category') or a
// metadata-prefixed key ('metadata.assay'); this strips the prefix to the bare
// key name (used for column headers).
export function bareFacet(facet: string) {
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

export function getRowStr(facet: string, row: Row) {
  return `${
    (isMetadataFacet(facet) ? row.metadata?.[bareFacet(facet)] : row[facet]) ??
    ''
  }`
}
