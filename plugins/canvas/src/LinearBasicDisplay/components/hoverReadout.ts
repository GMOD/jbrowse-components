import { looksLikeHTML } from '@jbrowse/core/util/htmlText'

import { isBaseResolved } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import { transcriptPosition } from '../transcriptPosition.ts'
import { residueLabel } from './peptidePositioning.ts'

import type { HitFeatureResult } from './hitTesting.ts'

// An HGVS name pairs a name with coordinates, so a subfeature wins only when it
// is transcript-shaped: a mature-peptide product carries a `displayLabel` but no
// `transcript`, and its label beside the parent's coordinates names nothing real.
function hitTranscriptAndName(result: HitFeatureResult) {
  const { subfeature, feature } = result
  return subfeature?.transcript
    ? { coords: subfeature.transcript, name: subfeature.displayLabel }
    : { coords: feature.transcript, name: feature.name }
}

// Naming the flanking exon of an intronic position would read as "you are in
// exon 5" when you are not, and the c./n. coordinate is only trustworthy once
// the cursor resolves to a single base.
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

// HGVS parenthesizes a gene symbol, so only a gene earns those brackets — an
// mRNA accession there states something else. Every gene-ish SO type ends in
// `gene` (`protein_coding_gene`, `ncRNA_gene`, `pseudogene`).
function hgvsGeneSymbol(result: HitFeatureResult) {
  const { subfeature, feature } = result
  return subfeature?.transcript && /gene$/i.test(feature.type ?? '')
    ? feature.name
    : undefined
}

export function hgvsHitLabel(result: HitFeatureResult) {
  const { hgvs, name } = transcriptReadouts(result)
  const gene = hgvsGeneSymbol(result)
  // A single-transcript annotation labels both with one name, and `EDEN(EDEN)`
  // names nothing twice.
  const accession = gene && gene !== name ? `${name}(${gene})` : name
  return hgvs && name ? `${accession}:${hgvs}` : hgvs
}

function tooltipRow(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// A list, never one string joined with `<br/>`: the join would answer
// `SanitizedHTML`'s markup-or-text question on the mouseover slot's behalf, and a
// feature whose mouseover reads `ALT <DEL>` loses the allele to the sanitizer.
export function hoverTooltipRows(result: HitFeatureResult) {
  const isoform = result.subfeature?.displayLabel
  const { peptide } = result
  const { exon, hgvs } = transcriptReadouts(result)
  const title = isoform ?? result.feature.tooltip
  const { name } = result.feature
  const gene = isoform && name !== isoform ? name : undefined
  const residue = peptide
    ? `${residueLabel(peptide)}${peptide.isTranslExcept ? ' (transl_except)' : ''}`
    : undefined
  return [
    tooltipRow(gene),
    tooltipRow(title),
    tooltipRow(exon, hgvs, residue),
  ].filter(Boolean)
}

// Text that merely contains angle brackets comes back whole, on the same
// `looksLikeHTML` call SanitizedHTML makes: parsing it regardless copies
// `ALT <DEL>` as `ALT `.
export function htmlToPlainText(html: string) {
  return looksLikeHTML(html)
    ? new DOMParser().parseFromString(
        html.replaceAll(/<br\s*\/?>/gi, '\n'),
        'text/html',
      ).body.textContent
    : html
}

export function hoverTooltipText(result: HitFeatureResult) {
  return hoverTooltipRows(result).map(htmlToPlainText).join('\n')
}
