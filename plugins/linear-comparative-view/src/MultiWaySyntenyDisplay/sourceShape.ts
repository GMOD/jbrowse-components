import { isNamedRecord } from '../syntenyMate.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * Whether each gutter reads its lower lane against the anchor: a source that
 * names an anchor and answers no lane pairs states each lane against it alone
 */
export function rowsReadAgainstAnchor(
  capabilities: readonly string[],
  starAnchor: string | undefined,
) {
  return starAnchor !== undefined && !capabilities.includes('lanePairsOnAnchor')
}

/**
 * The fetches beyond the anchor's that its records call for: each adjacent
 * lane pair's alignments, or each mate lane's own rows of a gene table, which a
 * star indexes on its anchor alone
 */
export function laneFetchesFor(
  features: readonly Feature[],
  rowsVsAnchor: boolean,
  starAnchor: string | undefined,
) {
  const named = features.some(isNamedRecord)
  return {
    lanePairs: features.length > 0 && !named && !rowsVsAnchor,
    laneRows: named && starAnchor === undefined,
  }
}

/**
 * Whether the lanes stack by structure: haplotypes of a source answering lane
 * pairs on the anchor's blocks, where a ribbon joins neighbours only. Gene
 * tables and stars stack densest-first
 */
export function stacksByStructure(
  capabilities: readonly string[],
  fetches: { lanePairs: boolean },
) {
  return capabilities.includes('lanePairsOnAnchor') && fetches.lanePairs
}
