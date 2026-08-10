import { isBaseResolved } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import {
  hgvsFromLocated,
  hgvsPosition,
  locateOnTranscript,
} from '../hgvsPosition.ts'
import { residueLabel } from './peptidePositioning.ts'

import type { HitFeatureResult } from './hitTesting.ts'

// What the hover SAYS about the thing under the cursor, as opposed to how that
// thing was found — the string half of the hit, split from hitTesting.ts, which
// is Flatbush index construction and spatial resolution and shares nothing with
// this but the `HitFeatureResult` these all take.
//
// Everything here is pure: a hit in, text out. That is what makes the tooltip,
// its clipboard twin, and the context menu's HGVS label testable without an MST
// tree or a DOM, and it is why the wording lives here rather than inside the
// components that render it.

// The transcript the cursor resolved to, together with the name that transcript
// goes by — resolved as ONE decision, because an HGVS name pairs the two and a
// name naming something other than the coordinate's own transcript is a wrong
// answer that reads like a right one.
//
// The subfeature wins when it is itself transcript-shaped (an isoform of a
// gene); otherwise the top-level feature's own coords and name are used,
// INCLUDING when a subfeature resolved. That last case is the one worth spelling
// out: a subfeature registered by a non-transcript glyph (a mature-peptide
// product, a repeat subpart, a bare exon row stacked beside a gene's transcripts
// — see registerSubfeature in glyphEmitters) carries a `displayLabel` but no
// `transcript`. Reading the label off the subfeature while the coordinates fell
// back to the parent produced names like `exon5:n.123` — the exon's label on the
// gene's coordinate system, in the exact syntax a variant is reported in.
function hitTranscriptAndName(result: HitFeatureResult) {
  const { subfeature, feature } = result
  return subfeature?.transcript
    ? { coords: subfeature.transcript, name: subfeature.displayLabel }
    : { coords: feature.transcript, name: feature.name }
}

// What the hover says about a position on a transcript: the exon it is in, and
// its HGVS coordinate.
//
// The exon is named only for an EXONIC position — naming the flanking exon of an
// intron would read as "you are in exon 5" when you are not, and the c. offset
// (`c.87+1`) already says which boundary you are past. A single-exon transcript
// says nothing: "exon 1/1" is noise.
//
// The c./n. coordinate needs the cursor to resolve to one base, so it appears
// only at base zoom (see isBaseResolved) — off by a base, it would be worse than
// absent. It is formatted from the SAME located position the exon is named from
// (hgvsFromLocated, not hgvsPosition), so the walk happens once per hover rather
// than once per readout — this runs on every mousemove.
function transcriptReadouts(result: HitFeatureResult) {
  const { coords } = hitTranscriptAndName(result)
  const located = coords && locateOnTranscript(coords, result.bpPos)
  return {
    exon:
      located?.offset === 0 && located.exonCount > 1
        ? `exon ${located.exonNumber}/${located.exonCount}`
        : undefined,
    hgvs:
      coords && located && isBaseResolved(result.bpPerPx)
        ? hgvsFromLocated(coords, located)
        : undefined,
  }
}

// The position as a clinical report would write it: the transcript's accession
// — whatever the annotation names it, which for RefSeq/Ensembl GFF3 is the
// versioned accession — joined to its c./n. coordinate, `NM_004006.2:c.93+1`.
// Falls back to the bare coordinate when the transcript is unnamed. Undefined
// unless the cursor resolved to a transcript at base zoom.
//
// This is the position half of an HGVS variant name; the change itself
// (`…c.93+1G>T`) needs an allele, which a gene annotation doesn't carry.
export function hgvsHitLabel(result: HitFeatureResult) {
  const { coords, name } = hitTranscriptAndName(result)
  const position =
    coords && isBaseResolved(result.bpPerPx)
      ? hgvsPosition(coords, result.bpPos)
      : undefined
  return position && name ? `${name}:${position}` : position
}

// One tooltip row: its parts share a line, space-separated, dropping any that
// are absent (e.g. no exon named for an intronic position).
function tooltipRow(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// The subfeature under the cursor names its containing feature (a
// transcript/isoform, or a mature-peptide product) on its own row, else the
// top-level feature's resolved `mouseover` slot. On a transcript the exon and
// HGVS coordinate under the cursor are named too on a second row — clinical
// reporting is written in those terms, and neither is practical to work out
// by eye. A hovered amino-acid letter adds its residue (e.g. `K124`) to that
// second row, so the isoform stays on its own. Empty rows (e.g. an unnamed
// feature with no transcript readout) are dropped.
function tooltipRows(result: HitFeatureResult) {
  const isoform = result.subfeature?.displayLabel
  const { peptide } = result
  const { exon, hgvs } = transcriptReadouts(result)
  const title = isoform ?? result.feature.tooltip
  // `(transl_except)` on a residue whose letter came from a transl_except
  // override rather than from the codon table — a selenocysteine read as U, a
  // pyrrolysine as O, a polyA-completed stop. The codon rect already paints
  // those in TRANSL_EXCEPT_HIGHLIGHT, but a color alone doesn't say what it
  // means, and `U840` on SELENOP is otherwise indistinguishable from a
  // mistranslation.
  const residue = peptide
    ? `${residueLabel(peptide)}${peptide.isTranslExcept ? ' (transl_except)' : ''}`
    : undefined
  return [tooltipRow(title), tooltipRow(exon, hgvs, residue)].filter(Boolean)
}

// The full tooltip, as HTML — see FeatureTooltip, which passes this through
// SanitizedHTML — so a literal `<br/>` is a line break rather than
// sanitized-away text.
export function hoverTooltip(result: HitFeatureResult) {
  return tooltipRows(result).join('<br/>')
}

// The reader's words out of whatever HTML a `mouseover` config expression
// returned (harmless as markup — FeatureTooltip only ever renders it, never
// executes it). `<br/>` becomes a newline before the tags go: joining fields
// with `<br/>` is the standard mouseover idiom, and textContent alone would run
// those fields together into one line.
export function htmlToPlainText(html: string) {
  return new DOMParser().parseFromString(
    html.replaceAll(/<br\s*\/?>/gi, '\n'),
    'text/html',
  ).body.textContent
}

// The same content as the hover tooltip, as plain text for the clipboard: rows
// join on a real newline instead of `<br/>`.
export function hoverTooltipText(result: HitFeatureResult) {
  return tooltipRows(result).map(htmlToPlainText).join('\n')
}
