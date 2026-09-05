import { aminoAcidsBySegment } from '../peptides/aggregateAminoAcids.ts'
import { dedupedSortedCDS } from '../peptides/cdsSegments.ts'

import type {
  AggregatedAminoAcid,
  CdsSegment,
} from '../peptides/aggregateAminoAcids.ts'
import type { RenderContext } from './renderContext.ts'
import type { Feature } from '@jbrowse/core/util'

// Returns CDS segments in transcription order. Shares the frameshift-guarding
// dedup with the peptide translation so protein indices align with the rendered
// rects.
export function transcriptCDS(feature: Feature, strand: number): CdsSegment[] {
  const cds = dedupedSortedCDS(feature)
  return strand === -1 ? cds.reverse() : cds
}

// Returns undefined when the feature has no pre-translated peptide (zoomed out,
// or colorByCDS off) so callers fall back to plain boxes.
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

// A cleavage falls between residues, so each codon belongs to exactly one
// product: a codon straddling a non-codon-aligned boundary goes to the product
// its start lands in, never to both.
export function aminoAcidsInRange(
  aminoAcids: AggregatedAminoAcid[],
  start: number,
  end: number,
) {
  return aminoAcids.filter(aa => aa.startBp >= start && aa.startBp < end)
}
