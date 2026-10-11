import {
  DEFAULT_CANONICAL_TRANSCRIPTS,
  isoformScorer,
  rankIsoforms,
  serializedIsoformReader,
} from '../../util/isoformRank.ts'

import type {
  SimpleFeatureSerialized,
  SimpleFeatureSerializedNoId,
} from '../../util/index.ts'
import type { CanonicalTranscripts } from '../../util/isoformRank.ts'
import type { SequenceDisplayMode, ShowCoordinatesMode } from './model.ts'

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

// The isoform the canvas gene glyph draws first, so the panel opens on the
// transcript the track showed. A feature that is itself a transcript has no
// nested transcripts to pick from.
export function pickDefaultTranscriptIndex(
  transcripts: SimpleFeatureSerialized[],
  canonical: CanonicalTranscripts = DEFAULT_CANONICAL_TRANSCRIPTS,
) {
  const [best] = rankIsoforms(
    transcripts,
    isoformScorer(serializedIsoformReader, canonical),
  )
  return best ? transcripts.indexOf(best) : 0
}

// the sequence types the selector offers, the first being the default
export function getAvailableModes(
  feature: SimpleFeatureSerializedNoId,
): SequenceDisplayMode[] {
  const coding: SequenceDisplayMode[] = featureHasCDS(feature)
    ? ['cds', 'protein']
    : []
  const rest: SequenceDisplayMode[] = featureHasExonOrCDS(feature)
    ? [
        'cdna',
        'gene',
        'gene_updownstream',
        'gene_collapsed_intron',
        'gene_updownstream_collapsed_intron',
      ]
    : ['genomic', 'genomic_sequence_updownstream']
  return [...coding, ...rest]
}

// The most recent pick this feature offers, so clicking from one gene to the
// next keeps e.g. the protein readout, and picking Genomic on a plain feature
// in between does not cost a gene its Protein.
export function resolveMode(
  recentModes: readonly SequenceDisplayMode[],
  feature: SimpleFeatureSerializedNoId,
) {
  const modes = getAvailableModes(feature)
  return recentModes.find(m => modes.includes(m)) ?? modes[0]!
}

// whether the mode renders up/downstream flanks. shared by the sequence body
// (which fetches+renders the flanks) and the FASTA header (which annotates
// them) so the two can't drift, e.g. gene_updownstream_collapsed_intron
// contains 'updownstream' but does not end with it
export function modeHasUpDownstream(mode: SequenceDisplayMode) {
  return mode.includes('updownstream')
}

// reverse complement reads the opposite strand of the genome, so it is offered
// for the genomic sequence types only: the antisense of a spliced cDNA, of an
// annotated CDS, or of a translated peptide is not a sequence anyone asked for.
// Shared by the menu (which offers it) and the panel (which applies it) so a
// toggle left on in a genomic mode can't silently flip a cDNA readout.
export function modeSupportsRevcomp(mode: SequenceDisplayMode) {
  return [
    'gene',
    'gene_collapsed_intron',
    'gene_updownstream',
    'gene_updownstream_collapsed_intron',
    'genomic',
    'genomic_sequence_updownstream',
  ].includes(mode)
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

// The coordinate mode a given sequence type actually renders. The setting is
// sticky and global, so a 'genomic' preference picked in e.g. gene mode
// survives a switch to a spliced mode that cannot label genomic positions;
// there it falls back to relative. Shared by the seqtypes (which render it) and
// the menu (which shows it as the checked radio) so the panel can't display one
// coordinate mode while the menu reports another.
export function resolveShowCoordinates(
  setting: ShowCoordinatesMode,
  mode: SequenceDisplayMode,
): ShowCoordinatesMode {
  return setting === 'genomic' && !showGenomicCoordsOption(mode)
    ? 'relative'
    : setting
}
