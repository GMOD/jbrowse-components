import type { FeatureLayout } from './types.ts'

// What chose the transcript each collapsed gene is showing. Counts rather than
// a flag, because one window holds both rules: NCBI tags its protein-coding
// genes and leaves most non-coding ones alone, so "something here used a tag"
// is true of nearly every window.
export interface IsoformPicks {
  byTag: Record<string, number>
  byLength: number
  // Genes the fit ladder's isoform rung trimmed. Always 0 from the worker,
  // since that trim is the main thread's.
  byCap: number
}

// One tag, two spellings: NCBI's GFF3 writes `tag=MANE Select` and GENCODE's
// `tag=MANE_Select`. Left apart, a window carrying both splits its own majority
// and the chip names the smaller half.
function tagRule(tag: string) {
  return tag.replaceAll('_', ' ')
}

function tallyPicks(
  picks: Pick<IsoformPicks, 'byTag' | 'byLength'>,
  picked: Iterable<{ canonicalTag?: string }>,
) {
  for (const { canonicalTag } of picked) {
    if (canonicalTag === undefined) {
      picks.byLength++
    } else {
      const rule = tagRule(canonicalTag)
      picks.byTag[rule] = (picks.byTag[rule] ?? 0) + 1
    }
  }
  return picks
}

export function summarizeIsoformPicks(layouts: FeatureLayout[]): IsoformPicks {
  return {
    ...tallyPicks(
      { byTag: {}, byLength: 0 },
      layouts.filter(layout => layout.isoformsCollapsed),
    ),
    byCap: 0,
  }
}

// The two sets never overlap: `longestCoding` leaves each gene one child and
// the trim's smallest k is 1, so a gene the worker collapsed is never trimmed
// again.
export function addTrimmedIsoformPicks(
  picks: IsoformPicks,
  trimmed: { canonicalTag?: string }[],
): IsoformPicks {
  if (trimmed.length === 0) {
    return picks
  }
  return {
    ...tallyPicks(
      { byTag: { ...picks.byTag }, byLength: picks.byLength },
      trimmed,
    ),
    byCap: picks.byCap + trimmed.length,
  }
}

// The chip speaks for the whole view. A fixture predating the field
// contributes nothing rather than throwing.
export function mergeIsoformPicks(
  picks: (IsoformPicks | undefined)[],
): IsoformPicks {
  const byTag: Record<string, number> = {}
  let byLength = 0
  let byCap = 0
  for (const pick of picks) {
    if (pick) {
      for (const [tag, n] of Object.entries(pick.byTag)) {
        byTag[tag] = (byTag[tag] ?? 0) + n
      }
      byLength += pick.byLength
      byCap += pick.byCap
    }
  }
  return { byTag, byLength, byCap }
}

// Ties break by name so panning between two equally common tags does not swap
// the chip's word back and forth.
function sortedTags(picks: IsoformPicks | undefined) {
  return Object.entries(picks?.byTag ?? {}).sort(
    ([a, x], [b, y]) => y - x || a.localeCompare(b),
  )
}

// The length fallback sorts last however common it is: it applies only where
// no other rule did, and reading it first implies the annotation names nothing.
export function isoformPickEntries(
  picks: IsoformPicks | undefined,
): [string, number][] {
  const length = picks?.byLength ?? 0
  const tags = sortedTags(picks)
  return length > 0 ? [...tags, ['longest coding', length]] : tags
}

export function dominantIsoformTag(picks: IsoformPicks | undefined) {
  return sortedTags(picks)[0]?.[0]
}

export function anyIsoformsHidden(picks: IsoformPicks | undefined) {
  return (
    picks !== undefined &&
    (picks.byLength > 0 || Object.keys(picks.byTag).length > 0)
  )
}
