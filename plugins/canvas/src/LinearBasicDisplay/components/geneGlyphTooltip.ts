import type { GeneGlyphMode } from '../geneGlyphMode.ts'

// The loud chip's text. Here beside the tooltip, and tested with it, because
// the two describe the same state and a gene drawn with 7 of its 28
// transcripts looks exactly like a gene with 7 — so the chip has to name which
// collapse this is rather than leaving it to the tooltip.
//
// A cap of one is spelled as the collapse it is: a very short lane resolves the
// row budget to 1, which read as "Top 1 isoforms".
export function geneGlyphChipLabel(maxIsoforms: number | undefined) {
  return maxIsoforms === undefined || maxIsoforms === 1
    ? 'One isoform'
    : `Top ${maxIsoforms} isoforms`
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
  noticeShowing,
}: {
  mode: GeneGlyphMode
  collapsed: boolean
  // the height cap hiding transcripts, or undefined when none is
  maxIsoforms?: number
  noticeShowing: boolean
}) {
  // "one transcript", not "the longest coding" one: an annotation that names its
  // own representative isoform (RefSeq Select, MANE Select) decides this, and
  // protein length is only the fallback for one that doesn't
  const showing = !collapsed
    ? 'Showing all transcripts per gene'
    : maxIsoforms === undefined
      ? "Showing one transcript per gene — the annotation's representative one where it names one, else the longest coding"
      : `Showing up to ${maxIsoforms} transcript${maxIsoforms === 1 ? '' : 's'} per gene — as many as fit this track's height`
  const auto =
    mode === 'auto' && collapsed && maxIsoforms === undefined
      ? ' — chosen automatically at this zoom'
      : ''
  const minimize = noticeShowing ? '; × to minimize this notice to an icon' : ''
  return `${showing}${auto}. Click to change${minimize}.`
}
