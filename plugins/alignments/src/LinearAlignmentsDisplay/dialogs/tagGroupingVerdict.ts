import { MAX_GROUPS, compareGroupKeys } from '../../shared/groupFeatures.ts'

// The caption GroupByDialog shows under the tag box, and whether Submit is
// refused. `undefined` while nothing describes the tag in the box — the caller
// is showing the scan's error or its progress line, or the box is empty.
export interface TagGroupingVerdict {
  // Refuses Submit. Read from this same object, so what the dialog says and what
  // it allows cannot come apart.
  blocks: boolean
  color: 'error' | 'warning.main' | 'text.secondary'
  text: string
}

/**
 * What the distinct-value scan says about grouping by `tag`.
 *
 * `tag` is the one group-by dimension whose cardinality the DATA decides, so it
 * is the only one that can produce a section list nobody asked for — and it can
 * do that at BOTH ends. The values are already in hand at the point of choice,
 * which is the whole reason this dialog scans: the worker would otherwise answer
 * either end silently, with 39 sections plus one opaque merged bucket, or
 * with a single section named for a tag no read carries.
 *
 * One verdict rather than a message here and a refusal there, because both are
 * read off the same count.
 */
export function tagGroupingVerdict(
  tag: string,
  values: string[] | undefined,
): TagGroupingVerdict | undefined {
  if (!values) {
    return undefined
  }
  // `>=`, not `>`: the scan reports only the values reads actually carry (it
  // drops the '' sentinel), and reads LACKING the tag take a section of their
  // own besides. So exactly MAX_GROUPS distinct values is already over the cap
  // the moment one read is untagged, which is the overflow merge this exists to
  // prevent. One value of headroom is the price of not knowing whether any read
  // is untagged without a second scan.
  if (values.length >= MAX_GROUPS) {
    return {
      blocks: true,
      color: 'error',
      text:
        `${tag} takes ${values.length} distinct values here — too many to ` +
        'stack, and each section costs its own render pass. Color reads by ' +
        'this tag instead, or group by a low-cardinality one (HP, RG).',
    }
  }
  // The other end of the same question. Every read files under the '' sentinel,
  // so the grouping draws ONE section named for a tag nothing here has — which
  // reads as a broken track, and costs a refetch to find out.
  //
  // Said rather than refused, unlike the cap: the scan covers the blocks in
  // view, and a grouping set here still does its job once the user navigates
  // somewhere the tag is written. What the cap prevents has no such upside.
  if (values.length === 0) {
    return {
      blocks: false,
      color: 'warning.main',
      text:
        `No read in view carries ${tag}. Grouping by it draws a single ` +
        `"${tag}: none" section holding every read, until you navigate ` +
        'somewhere the tag is set.',
    }
  }
  // Listed in the order the sections will stack — the scan returns them in
  // whichever order the reads arrived, so an HP preview read "2, 1" over a track
  // about to draw HP 1 first.
  return {
    blocks: false,
    color: 'text.secondary',
    text: `Found values: ${[...values].sort(compareGroupKeys).join(', ')}`,
  }
}
