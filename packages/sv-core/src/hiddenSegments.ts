import { pluralize } from '@jbrowse/core/util'

// The tooltip line naming the loci a connector skipped, segments of its read
// the view never fetched: the connector is real, its DIRECTNESS is not, and
// this line is what says so. Worded once for the alignments overlay and the
// breakpoint split view, so the reader who met this finding in one does not
// have to learn a second phrasing in the other.
export function hiddenSegmentsNote(loci: string[]) {
  return `hidden ${pluralize(loci.length, 'segment')} not in view: ${loci.join(', ')}`
}
