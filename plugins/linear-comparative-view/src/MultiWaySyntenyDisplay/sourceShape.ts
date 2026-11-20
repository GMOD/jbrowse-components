import { isNamedRecord } from '../syntenyMate.ts'

import type { LaneRowsField } from './copyLane.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * Whether each gutter reads its far lane against the anchor: a source that
 * names an anchor and answers no lane pairs states each lane against it
 * alone, and so does any source for copy lanes, since two copies of one
 * genome are paired only through the anchor gene they share
 */
export function rowsReadAgainstAnchor(
  capabilities: readonly string[],
  starAnchor: string | undefined,
  field: LaneRowsField,
) {
  return (
    field === 'refName' ||
    (starAnchor !== undefined && !capabilities.includes('lanePairsOnAnchor'))
  )
}

/**
 * The fetches beyond the anchor's that its records call for: each adjacent
 * lane pair's alignments, or each mate lane's own rows of a gene table, which a
 * star indexes on its anchor alone and lanes read against the anchor never
 * draw
 */
export function laneFetchesFor(
  features: readonly Feature[],
  rowsVsAnchor: boolean,
  starAnchor: string | undefined,
) {
  const named = features.some(isNamedRecord)
  return {
    lanePairs: features.length > 0 && !named && !rowsVsAnchor,
    laneRows: named && starAnchor === undefined && !rowsVsAnchor,
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

/**
 * The anchor's name in a lane's `vs` badge and the legend where the lanes
 * read against it: its label beside copy lanes, whose labels name their
 * genome's, else its assembly name
 */
export function againstAnchorName(
  rowsVsAnchor: boolean,
  field: LaneRowsField,
  anchor: string,
  labelOf: (lane: string) => string,
) {
  return rowsVsAnchor
    ? field === 'refName'
      ? labelOf(anchor)
      : anchor
    : undefined
}
