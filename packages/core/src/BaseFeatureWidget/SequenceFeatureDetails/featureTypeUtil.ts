import type { SequenceDisplayMode } from './model.ts'
import type { SimpleFeatureSerialized } from '../../util/index.ts'

export function featureHasCDS(feature: SimpleFeatureSerialized) {
  if (feature.type?.toLowerCase() === 'mature_protein_region_of_cds') {
    return true
  }
  return (
    feature.subfeatures?.some(sub => {
      const type = sub.type?.toLowerCase()
      return type === 'cds' || type === 'mature_protein_region_of_cds'
    }) ?? false
  )
}

export function featureHasExon(feature: SimpleFeatureSerialized) {
  return (
    feature.subfeatures?.some(sub => sub.type?.toLowerCase() === 'exon') ?? false
  )
}

export function featureHasExonOrCDS(feature: SimpleFeatureSerialized) {
  return featureHasExon(feature) || featureHasCDS(feature)
}

export function getDefaultMode(
  feature: SimpleFeatureSerialized,
): SequenceDisplayMode {
  return featureHasCDS(feature)
    ? 'cds'
    : featureHasExon(feature)
      ? 'cdna'
      : 'genomic'
}

// genomic coordinates only make sense for continuous genome-based sequence
// types (not collapsed-intron or spliced views)
export function showGenomicCoordsOption(mode: SequenceDisplayMode) {
  return (
    mode === 'gene' ||
    mode === 'gene_updownstream' ||
    mode === 'genomic' ||
    mode === 'genomic_sequence_updownstream'
  )
}
