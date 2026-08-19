import {
  anyIsoformsHidden,
  dominantIsoformTag,
  isoformPickEntries,
} from '../../RenderFeatureDataRPC/isoformPicks.ts'

import type { IsoformPicks } from '../../RenderFeatureDataRPC/isoformPicks.ts'
import type { GeneGlyphMode } from '../geneGlyphMode.ts'

// The loud chip's text. Beside the tooltip, and tested with it, because a gene
// drawn with 7 of its 28 transcripts looks exactly like a gene with 7 — the
// collapse is invisible in the rendering, so the chip has to name which one this
// is rather than leaving it to a tooltip nobody has hovered.
//
// Every branch names the RULE, never a count: a count is the one number a reader
// already has by looking at a gene, and it says nothing about the 22 isoforms
// missing from one and the 1 missing from the next. What is missing is per-gene
// and says so on each gene's own label (`moreIsoformsLabel`), which leaves the
// chip naming the track-wide rule those badges are the consequence of. The chip
// gets the commonest rule and the tooltip the breakdown; a window mixing tagged
// and untagged genes is normal.
export function geneGlyphChipLabel(
  maxIsoforms: number | undefined,
  picks?: IsoformPicks,
) {
  if (maxIsoforms !== undefined && maxIsoforms > 1) {
    return 'Isoforms trimmed to fit'
  }
  const tag = dominantIsoformTag(picks)
  if (tag) {
    return tag
  }
  // Three states, not two. The mode turns the chip loud the instant it changes,
  // while WHICH rule picked what is the worker's answer one fetch later — until
  // it lands the loaded data is the previous mode's and has reported no pick, so
  // "Longest isoform" there is a claim, and a wrong one for the whole fetch on
  // every tagged annotation. `anyIsoformsHidden` separates "nothing has told us
  // yet" from "the genes here carry no tag".
  return anyIsoformsHidden(picks) ? 'Longest isoform' : 'One isoform'
}

// What actually chose the transcripts on screen: "the RefSeq Select transcript"
// when every collapsed gene agrees, else the count under each rule — the chip
// has room for one of them and this is the only place the mixture is visible.
function pickPhrase(picks: IsoformPicks | undefined) {
  const entries = isoformPickEntries(picks)
  return entries.length === 1
    ? `the ${entries[0]![0]} transcript`
    : entries.length > 1
      ? entries.map(([rule, n]) => `${n} by ${rule}`).join(', ')
      : undefined
}

// The isoform-collapse control's tooltip: what it is currently showing, whether
// that was the user's choice or the zoom's, and how to dismiss the notice.
//
// The minimize clause keys on `noticeShowing` — the same term deciding whether
// the control gets an `onDelete` — NOT on `dismissed`. The control renders as
// the bare icon in two situations (dismissed, and transcripts simply not
// collapsed), and dismissal alone described a × the second never draws. Pure and
// in its own module so a test can hold the clause and the affordance together.
export function geneGlyphTooltip({
  mode,
  collapsed,
  maxIsoforms,
  picks,
  noticeShowing,
}: {
  mode: GeneGlyphMode
  collapsed: boolean
  // the height cap hiding transcripts, or undefined when none is
  maxIsoforms?: number
  // what picked each collapsed gene's transcript, counted per rule
  picks?: IsoformPicks
  noticeShowing: boolean
}) {
  const picked = pickPhrase(picks)
  const tag = dominantIsoformTag(picks)
  // The rule, from the data rather than from the mode's name: an annotation that
  // names its own representative isoform (RefSeq Select, MANE Select) decides
  // this, and protein length is only the fallback for one that doesn't.
  const showing = !collapsed
    ? 'Showing all transcripts per gene'
    : maxIsoforms === undefined
      ? `Showing one transcript per gene — ${picked ?? "the annotation's representative one where it names one, else the longest coding"}`
      : `Showing up to ${maxIsoforms} transcript${maxIsoforms === 1 ? '' : 's'} per gene — as many as fit this track's height${tag ? `, ${tag} first` : ''}`
  const auto =
    mode === 'auto' && collapsed && maxIsoforms === undefined
      ? ' — chosen automatically at this zoom'
      : ''
  const minimize = noticeShowing ? '; × to minimize this notice to an icon' : ''
  return `${showing}${auto}. Click to change${minimize}.`
}
