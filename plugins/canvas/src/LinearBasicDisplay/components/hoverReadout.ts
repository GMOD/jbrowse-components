import { looksLikeHTML } from '@jbrowse/core/util/htmlText'

import { isBaseResolved } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import { transcriptPosition } from '../transcriptPosition.ts'
import { residueLabel } from './peptidePositioning.ts'

import type { HitFeatureResult } from './hitTesting.ts'

// What the hover SAYS about the thing under the cursor; hitTesting.ts is how it
// was found. Pure functions — a hit in, text out — so the tooltip, its clipboard
// twin and the context menu's HGVS label are testable without an MST tree.

// The transcript the cursor resolved to and the name that transcript goes by,
// resolved together: an HGVS name pairs the two, so a name off one feature over
// coordinates off another reads as a right answer and isn't one. A subfeature
// wins only when it is itself transcript-shaped — a mature-peptide product or a
// repeat subpart carries a `displayLabel` but no `transcript`, and taking its
// label beside the parent's coordinates produced names like `exon5:n.123`.
function hitTranscriptAndName(result: HitFeatureResult) {
  const { subfeature, feature } = result
  return subfeature?.transcript
    ? { coords: subfeature.transcript, name: subfeature.displayLabel }
    : { coords: feature.transcript, name: feature.name }
}

// The exon the cursor is in, its HGVS coordinate, and the transcript both were
// measured on. The exon is named only for an exonic position (naming the
// flanking exon of an intron reads as "you are in exon 5" when you are not) and
// never for a single-exon transcript. The c./n. coordinate needs the cursor to
// resolve to one base, so it appears only at base zoom — off by a base it would
// be worse than absent.
function transcriptReadouts(result: HitFeatureResult) {
  const { coords, name } = hitTranscriptAndName(result)
  const located = coords && transcriptPosition(coords, result.bpPos)
  return {
    name,
    exon:
      located?.offset === 0 && located.exonCount > 1
        ? `exon ${located.exonNumber}/${located.exonCount}`
        : undefined,
    hgvs: located && isBaseResolved(result.bpPerPx) ? located.hgvs : undefined,
  }
}

// The position as a clinical report writes it — `NM_004006.2:c.93+1` — falling
// back to the bare coordinate when the transcript is unnamed. The change itself
// (`…G>T`) needs an allele, which a gene annotation doesn't carry.
export function hgvsHitLabel(result: HitFeatureResult) {
  const { hgvs, name } = transcriptReadouts(result)
  return hgvs && name ? `${name}:${hgvs}` : hgvs
}

function tooltipRow(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// The isoform (or the feature's `mouseover` slot) on one row; the exon, HGVS
// coordinate and hovered residue on a second. Empty rows are dropped.
//
// A LIST, never one string joined with `<br/>`: `SanitizedHTML` decides whether
// a string is markup by looking for a known tag (looksLikeHTML), so a generated
// `<br/>` answers that question on the mouseover slot's behalf and a feature
// whose mouseover reads `ALT <DEL>` loses the allele to the sanitizer.
// FeatureTooltip renders one element per row, so each row is judged on its own.
export function hoverTooltipRows(result: HitFeatureResult) {
  const isoform = result.subfeature?.displayLabel
  const { peptide } = result
  const { exon, hgvs } = transcriptReadouts(result)
  const title = isoform ?? result.feature.tooltip
  // `(transl_except)` where the letter came from a transl_except override rather
  // than the codon table — the codon rect is highlighted for it, but `U840` on
  // SELENOP is otherwise indistinguishable from a mistranslation.
  const residue = peptide
    ? `${residueLabel(peptide)}${peptide.isTranslExcept ? ' (transl_except)' : ''}`
    : undefined
  return [tooltipRow(title), tooltipRow(exon, hgvs, residue)].filter(Boolean)
}

// The reader's words out of whatever a `mouseover` expression returned. `<br/>`
// becomes a newline before the tags go, since joining fields with it is the
// standard mouseover idiom. Text that merely contains angle brackets is returned
// whole on `looksLikeHTML`'s say-so — the same call SanitizedHTML makes about
// the same string — because parsing it regardless copied `ALT <DEL>` as `ALT `.
export function htmlToPlainText(html: string) {
  return looksLikeHTML(html)
    ? new DOMParser().parseFromString(
        html.replaceAll(/<br\s*\/?>/gi, '\n'),
        'text/html',
      ).body.textContent
    : html
}

// The tooltip's content as plain text for the clipboard.
export function hoverTooltipText(result: HitFeatureResult) {
  return hoverTooltipRows(result).map(htmlToPlainText).join('\n')
}
