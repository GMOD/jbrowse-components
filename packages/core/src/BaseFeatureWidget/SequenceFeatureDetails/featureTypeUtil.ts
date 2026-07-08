import type { SequenceDisplayMode } from './model.ts'
import type {
  SimpleFeatureSerialized,
  SimpleFeatureSerializedNoId,
} from '../../util/index.ts'

// these predicates only ever read type/subfeatures, so they accept a bare
// subfeature (no guaranteed uniqueId) as readily as a full feature
export function featureHasCDS(feature: SimpleFeatureSerializedNoId) {
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

export function featureHasExon(feature: SimpleFeatureSerializedNoId) {
  return (
    feature.subfeatures?.some(sub => sub.type?.toLowerCase() === 'exon') ??
    false
  )
}

export function featureHasExonOrCDS(feature: SimpleFeatureSerializedNoId) {
  return featureHasExon(feature) || featureHasCDS(feature)
}

// A container feature's (e.g. a gene's) direct subfeatures that are
// themselves transcripts (have their own exon/CDS). An actual transcript's
// exon/CDS children don't have exon/CDS of their own, so this bottoms out
// one level down without a type-name allowlist. Synthesizes a uniqueId the
// same way FeatureDetails does for nested subfeature cards, since a
// subfeature isn't guaranteed one by its type.
export function getTranscripts(
  feature: SimpleFeatureSerialized,
): SimpleFeatureSerialized[] {
  return (
    feature.subfeatures
      ?.filter(sub => featureHasExonOrCDS(sub))
      .map((sub, idx) => ({
        ...sub,
        uniqueId: `${feature.uniqueId}_${idx}`,
      })) ?? []
  )
}

// index of the transcript the gene glyph itself would collapse to in
// 'longestCoding' mode (RenderFeatureDataRPC/glyphs/subfeatures.ts): prefer a
// coding transcript, then the longest span — so the sequence panel's default
// matches what the track already drew.
export function pickDefaultTranscriptIndex(
  transcripts: SimpleFeatureSerialized[],
) {
  const coding = transcripts.filter(t => featureHasCDS(t))
  const candidates = coding.length > 0 ? coding : transcripts
  const longest = candidates.reduce((a, b) =>
    b.end - b.start > a.end - a.start ? b : a,
  )
  return transcripts.indexOf(longest)
}

export function getDefaultMode(
  feature: SimpleFeatureSerializedNoId,
): SequenceDisplayMode {
  return featureHasCDS(feature)
    ? 'cds'
    : featureHasExon(feature)
      ? 'cdna'
      : 'genomic'
}

// whether the mode renders up/downstream flanks. shared by the sequence body
// (which fetches+renders the flanks) and the FASTA header (which annotates
// them) so the two can't drift, e.g. gene_updownstream_collapsed_intron
// contains 'updownstream' but does not end with it
export function modeHasUpDownstream(mode: SequenceDisplayMode) {
  return mode.includes('updownstream')
}

// genomic coordinates only make sense for continuous genome-based sequence
// types (not collapsed-intron or spliced views)
export function showGenomicCoordsOption(mode: SequenceDisplayMode) {
  return [
    'gene',
    'gene_updownstream',
    'genomic',
    'genomic_sequence_updownstream',
  ].includes(mode)
}
