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
    return 'Isoforms trimmed'
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

// What actually chose the transcripts on screen: "RefSeq Select" when every
// collapsed gene agrees, else the count under each rule — the chip has room for
// one of them and this is the only place the mixture is visible.
function pickPhrase(picks: IsoformPicks | undefined) {
  const entries = isoformPickEntries(picks)
  return entries.length === 1
    ? entries[0]![0]
    : entries.length > 1
      ? entries.map(([rule, n]) => `${n} ${rule}`).join(', ')
      : undefined
}

// The isoform-collapse control's tooltip: what is on screen, what chose it, and
// the lever that changes it. Terse on purpose — the chip is the notice, this is
// its footnote, and the ▾ already says the press opens a menu.
export function geneGlyphTooltip({
  mode,
  collapsed,
  maxIsoforms,
  picks,
}: {
  mode: GeneGlyphMode
  collapsed: boolean
  // the count the fit ladder trimmed to, or undefined when it trimmed nothing.
  // A ceiling rather than a promise: a gene with fewer transcripts than this
  // draws all of them, and each gene's own badge names what it left out.
  maxIsoforms?: number
  // what picked each collapsed gene's transcript, counted per rule
  picks?: IsoformPicks
}) {
  if (!collapsed) {
    return 'All transcripts per gene.'
  }
  if (maxIsoforms !== undefined) {
    // The trim has two levers and neither is visible from the menu: it exists
    // only under Auto, so All transcripts lifts it, and it is solved against
    // the track, so a taller track (or autogrow, next door) admits more.
    const tag = dominantIsoformTag(picks)
    return `Up to ${maxIsoforms} transcript${maxIsoforms === 1 ? '' : 's'} per gene fit this height${tag ? ` (${tag} first)` : ''}. A taller track or All transcripts shows more.`
  }
  // The rule, from the data rather than from the mode's name: an annotation
  // that names its own representative isoform (RefSeq Select, MANE Select)
  // decides this, and protein length is only the fallback for one that doesn't.
  const picked = pickPhrase(picks)
  const zoom = mode === 'auto' ? ', chosen by zoom. Zoom in for all' : ''
  return `One transcript per gene${picked ? ` (${picked})` : ''}${zoom}.`
}
