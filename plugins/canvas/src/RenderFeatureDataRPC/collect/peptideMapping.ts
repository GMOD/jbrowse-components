import { aminoAcidsBySegment } from '../peptides/aggregateAminoAcids.ts'
import { dedupedSortedCDS } from '../peptides/cdsSegments.ts'

import type { RenderContext } from './renderContext.ts'
import type {
  AggregatedAminoAcid,
  CdsSegment,
} from '../peptides/aggregateAminoAcids.ts'
import type { Feature } from '@jbrowse/core/util'

// CDS segments in transcription order: dedupedSortedCDS yields ascending genomic
// start, reversed here for the - strand. Shares the frameshift-guarding dedup
// with the peptide translation so protein indices align with the rendered rects.
export function transcriptCDS(feature: Feature, strand: number): CdsSegment[] {
  const cds = dedupedSortedCDS(feature)
  return strand === -1 ? cds.reverse() : cds
}

// Maps the feature's pre-translated protein (computed worker-side in
// fetchPeptideData, keyed by feature id) back onto its CDS segments. Returns
// undefined when no peptide data is present (zoomed out, or colorByCDS off) so
// callers fall back to plain boxes. Single source for both the exon overlay and
// the polyprotein overlay so their genomic-to-residue mapping can never drift.
export function aminoAcidsByFeature(feature: Feature, ctx: RenderContext) {
  const strand = feature.get('strand') ?? 0
  const peptide = ctx.peptideDataMap?.get(feature.id())
  return peptide
    ? aminoAcidsBySegment(
        transcriptCDS(feature, strand),
        peptide.protein,
        strand,
        peptide.translExceptIndices,
      )
    : undefined
}

// A polyprotein is translated as one ORF, then cleaved *between* residues into
// mature peptides — so each codon belongs to exactly one cleavage product. We
// assign by the codon's genomic start; a codon straddling a boundary that isn't
// codon-aligned (a data quirk — real cleavage sites fall between codons) goes to
// the product its start lands in, never to both.
export function aminoAcidsInRange(
  aminoAcids: AggregatedAminoAcid[],
  start: number,
  end: number,
) {
  return aminoAcids.filter(aa => aa.startBp >= start && aa.startBp < end)
}
