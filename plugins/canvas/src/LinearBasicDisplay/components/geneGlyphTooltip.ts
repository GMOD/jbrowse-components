import {
  anyIsoformsHidden,
  dominantIsoformTag,
  isoformPickEntries,
} from '../../RenderFeatureDataRPC/isoformPicks.ts'

import type { IsoformPicks } from '../../RenderFeatureDataRPC/isoformPicks.ts'
import type { GeneGlyphMode } from '../geneGlyphMode.ts'

// The loud chip's text. Here beside the tooltip, and tested with it, because
// the two describe the same state and a gene drawn with 7 of its 28
// transcripts looks exactly like a gene with 7 — so the chip has to name which
// collapse this is rather than leaving it to the tooltip.
//
// A one-per-gene collapse names the RULE that picked the transcript, not the
// count: "One isoform" said only that transcripts were missing, while the thing
// a reader needs to know about the one on screen is that it is the annotation's
// own RefSeq Select / MANE Select transcript rather than a guess. It is a chip,
// so it gets the commonest rule and the tooltip gets the breakdown; a window
// mixing tagged and untagged genes is normal (NCBI tags its protein-coding
// genes and leaves most non-coding ones alone).
//
// A cap of one is spelled as the collapse it is: a very short lane resolves the
// row budget to 1, which read as "Top 1 isoforms".
export function geneGlyphChipLabel(
  maxIsoforms: number | undefined,
  picks?: IsoformPicks,
) {
  if (maxIsoforms !== undefined && maxIsoforms > 1) {
    return `Top ${maxIsoforms} isoforms`
  }
  const tag = dominantIsoformTag(picks)
  if (tag) {
    return tag
  }
  // Three states, not two. The mode is the main thread's own decision and turns
  // the chip loud the instant it changes — the zoom crossing `auto`'s threshold,
  // or the user picking Representative from this chip's own menu — while WHICH
  // rule picked what is the worker's answer, one fetch later. Until that lands
  // the loaded data is still the previous mode's and has reported no pick at
  // all, so "Longest isoform" there is a claim, and a wrong one for the whole
  // fetch on every tagged annotation. `anyIsoformsHidden` is what separates
  // "nothing has told us yet" from "the genes here carry no tag", and the count
  // is what the mode alone justifies saying.
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
// Pure and in its own module rather than inline in GeneGlyphControl.tsx purely so
// it can be tested: the clause below has to agree with an affordance drawn by a
// sibling prop, and nothing but a test on the string can hold those two together.
//
// `noticeShowing` is that sibling — the same term deciding whether the control
// gets an `onDelete` at all — NOT `dismissed`. The control renders as the bare
// icon in two different situations (dismissed, and transcripts simply not
// collapsed), and keying the clause on dismissal alone described a × that the
// second of them never draws.
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
