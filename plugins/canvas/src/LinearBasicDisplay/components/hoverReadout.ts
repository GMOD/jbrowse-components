import { looksLikeHTML } from '@jbrowse/core/util/htmlText'

import { isBaseResolved } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import { transcriptPosition } from '../transcriptPosition.ts'
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

// What the hover says about a position on a transcript: the exon it is in, its
// HGVS coordinate, and the name of the transcript both were measured on.
//
// The exon is named only for an EXONIC position — naming the flanking exon of an
// intron would read as "you are in exon 5" when you are not, and the c. offset
// (`c.87+1`) already says which boundary you are past. A single-exon transcript
// says nothing: "exon 1/1" is noise.
//
// The c./n. coordinate needs the cursor to resolve to one base, so it appears
// only at base zoom (see isBaseResolved) — off by a base, it would be worse than
// absent. Every readout below comes through here, so the tooltip and the menu
// label cannot disagree about which base was hit or whether the zoom was fine
// enough to name it; they used to reach the coordinate by two different routes.
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

// The position as a clinical report would write it: the transcript's accession
// — whatever the annotation names it, which for RefSeq/Ensembl GFF3 is the
// versioned accession — joined to its c./n. coordinate, `NM_004006.2:c.93+1`.
// Falls back to the bare coordinate when the transcript is unnamed. Undefined
// unless the cursor resolved to a transcript at base zoom.
//
// This is the position half of an HGVS variant name; the change itself
// (`…c.93+1G>T`) needs an allele, which a gene annotation doesn't carry.
export function hgvsHitLabel(result: HitFeatureResult) {
  const { hgvs, name } = transcriptReadouts(result)
  return hgvs && name ? `${name}:${hgvs}` : hgvs
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
//
// A LIST, and never joined into one HTML string with `<br/>`: `SanitizedHTML`
// decides whether a string is markup or text by looking for a known tag in it
// (looksLikeHTML), so a generated `<br/>` answered that question on the
// mouseover slot's behalf. A feature whose mouseover reads `ALT <DEL>` showed
// exactly that on its own — the brackets aren't a tag, so they get escaped —
// and lost the allele to the sanitizer the moment a second row appeared beside
// it. FeatureTooltip renders one element per row instead, so each row is judged
// on its own text, which is also the judgement hoverTooltipText makes.
export function hoverTooltipRows(result: HitFeatureResult) {
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

// The reader's words out of whatever a `mouseover` config expression returned
// (harmless as markup — FeatureTooltip only ever renders it, never executes
// it). `<br/>` becomes a newline before the tags go: joining fields with
// `<br/>` is the standard mouseover idiom, and textContent alone would run
// those fields together into one line.
//
// Text that merely CONTAINS angle brackets is returned whole, on
// `looksLikeHTML`'s say-so, which is the same call SanitizedHTML makes about
// the same string. Parsing it regardless is what dropped a VCF symbolic allele
// (`ALT <DEL>` copied as `ALT `) off a tooltip that displayed it in full.
export function htmlToPlainText(html: string) {
  return looksLikeHTML(html)
    ? new DOMParser().parseFromString(
        html.replaceAll(/<br\s*\/?>/gi, '\n'),
        'text/html',
      ).body.textContent
    : html
}

// The same content as the hover tooltip, as plain text for the clipboard: rows
// join on a real newline.
export function hoverTooltipText(result: HitFeatureResult) {
  return hoverTooltipRows(result).map(htmlToPlainText).join('\n')
}
