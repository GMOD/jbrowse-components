export interface Row {
  id: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export function getRowStr(facet: string, row: Row) {
  return `${
    (facet.startsWith('metadata.')
      ? row.metadata?.[facet.replace('metadata.', '')]
      : row[facet]) || ''
  }`
}
