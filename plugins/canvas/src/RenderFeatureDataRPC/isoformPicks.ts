import type { FeatureLayout } from './types.ts'

// What actually chose the transcript each collapsed gene is showing: a count per
// curated tag (`RefSeq Select`, `MANE Select`, …) and a count for the genes
// whose annotation tagged nothing, which fell back to protein length.
//
// Counts rather than a flag, because one window holds both. NCBI tags its
// protein-coding genes and leaves most non-coding ones alone, so "something here
// used a tag" is true of nearly every window and says nothing about what the
// reader is looking at. The chip names the tag that picked the most genes on
// screen; the tooltip spends the whole breakdown.
export interface IsoformPicks {
  byTag: Record<string, number>
  byLength: number
  // Genes the fit ladder's isoform rung trimmed, whatever rule ranked their
  // survivors. Always 0 from the worker: the trim is the main thread's, and the
  // chip announces it off the solve rather than off anything being hidden — a
  // region fetched under `longestCoding` reports every multi-isoform gene as
  // collapsed and the ladder never touched it.
  byCap: number
}

// One tag, two spellings: NCBI's GFF3 writes `tag=MANE Select` and GENCODE's
// writes `tag=MANE_Select`, and `canonicalTranscriptTags` lists both so either
// file ranks. They are the same curated decision, so they count as one rule —
// left apart, a window carrying both splits its own majority and the chip names
// the smaller half.
function tagRule(tag: string) {
  return tag.replaceAll('_', ' ')
}

export function summarizeIsoformPicks(layouts: FeatureLayout[]): IsoformPicks {
  const byTag: Record<string, number> = {}
  let byLength = 0
  for (const { isoformsCollapsed, canonicalTag } of layouts) {
    if (!isoformsCollapsed) {
      continue
    }
    if (canonicalTag === undefined) {
      byLength++
    } else {
      const rule = tagRule(canonicalTag)
      byTag[rule] = (byTag[rule] ?? 0) + 1
    }
  }
  return { byTag, byLength, byCap: 0 }
}

// The worker's picks plus the genes the main-thread trim took isoforms off:
// each counts under the rule that ranked its survivors, exactly as a
// worker-side collapse does, and under `byCap` — the chip's one piece of
// evidence that the ladder is what is hiding transcripts here.
//
// The two sets never overlap. `longestCoding` leaves each gene one child, and
// the trim's smallest k is 1, so a gene the worker collapsed is never trimmed
// again.
export function addTrimmedIsoformPicks(
  picks: IsoformPicks,
  trimmed: { canonicalTag?: string }[],
): IsoformPicks {
  if (trimmed.length === 0) {
    return picks
  }
  const byTag = { ...picks.byTag }
  let byLength = picks.byLength
  for (const { canonicalTag } of trimmed) {
    if (canonicalTag === undefined) {
      byLength++
    } else {
      const rule = tagRule(canonicalTag)
      byTag[rule] = (byTag[rule] ?? 0) + 1
    }
  }
  return { byTag, byLength, byCap: picks.byCap + trimmed.length }
}

// One summary over every loaded region, since the chip speaks for the whole
// view. Fixtures that predate the field contribute nothing rather than throwing.
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

// Commonest first; ties break by name so panning between two equally common tags
// doesn't swap the chip's word back and forth.
function sortedTags(picks: IsoformPicks | undefined) {
  return Object.entries(picks?.byTag ?? {}).sort(
    ([a, x], [b, y]) => y - x || a.localeCompare(b),
  )
}

// Every rule that picked a gene here, commonest first, paired with its count.
// The length fallback sorts last however common it is: it is the rule that
// applies when no other one did, and reading it first implies the annotation
// names nothing.
export function isoformPickEntries(
  picks: IsoformPicks | undefined,
): [string, number][] {
  const length = picks?.byLength ?? 0
  const tags = sortedTags(picks)
  return length > 0 ? [...tags, ['longest coding', length]] : tags
}

// The tag the chip names.
export function dominantIsoformTag(picks: IsoformPicks | undefined) {
  return sortedTags(picks)[0]?.[0]
}

// Some gene here is drawn with isoforms missing.
export function anyIsoformsHidden(picks: IsoformPicks | undefined) {
  return (
    picks !== undefined &&
    (picks.byLength > 0 || Object.keys(picks.byTag).length > 0)
  )
}

// The fit ladder's isoform rung, specifically, trimmed some gene here — the
// only evidence the chip may announce a trim on. A region fetched under
// `longestCoding` reports every multi-isoform gene as collapsed, and a trim
// gated on that alone went loud on data the ladder never touched.
export function capHidIsoforms(picks: IsoformPicks | undefined) {
  return picks !== undefined && picks.byCap > 0
}
