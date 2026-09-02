import { pluralize } from '@jbrowse/core/util'

// `stroke-dasharray` for a junction whose read passes through segments the view
// never fetched: the connector is real, its DIRECTNESS is not. One constant for
// the alignments overlay and the breakpoint split view, which draw the same read
// the same way one band apart.
export const HIDDEN_SEGMENT_DASH = '4 3'

// The tooltip line naming the loci a dashed connector skipped, worded once for
// both views so the reader who met this finding in one does not have to learn a
// second phrasing in the other.
export function hiddenSegmentsNote(loci: string[]) {
  return `hidden ${pluralize(loci.length, 'segment')} not in view: ${loci.join(', ')}`
}
