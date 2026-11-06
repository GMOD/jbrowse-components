import {
  DEFAULT_CANONICAL_TRANSCRIPTS,
  isoformScorer,
  rankIsoforms,
  serializedIsoformReader,
} from '../../util/isoformRank.ts'
import { sequenceModes } from './sequenceModes.ts'

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

// A container feature's (e.g. a gene's) subfeatures that have children of
// their own: the transcripts the details panel draws as cards. A pick without
// exon or CDS of its own leaves the sequence panel on the container. Each takes
// the uniqueId the details panel gives the same subfeature's card.
export function getTranscripts(
  feature: SimpleFeatureSerialized,
): SimpleFeatureSerialized[] {
  return (feature.subfeatures ?? []).flatMap((sub, idx) =>
    sub.subfeatures?.length
      ? [{ ...sub, uniqueId: `${feature.uniqueId}_${idx}` }]
      : [],
  )
}

// `transcripts` best first, each with its index: the isoform the canvas gene
// glyph draws first leads, so the panel opens on the transcript the track
// showed
export function rankTranscripts(
  transcripts: SimpleFeatureSerialized[],
  canonical: CanonicalTranscripts = DEFAULT_CANONICAL_TRANSCRIPTS,
) {
  const score = isoformScorer(serializedIsoformReader, canonical)
  return rankIsoforms(
    transcripts.map((transcript, index) => ({ transcript, index })),
    entry => score(entry.transcript),
  )
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
// them) so the two can't drift
export function modeHasUpDownstream(mode: SequenceDisplayMode) {
  return sequenceModes[mode].upDownstream
}

// reverse complement reads the opposite strand of the genome, so it is offered
// for the genomic sequence types only: the antisense of a spliced cDNA, of an
// annotated CDS, or of a translated peptide is not a sequence anyone asked for.
// Shared by the menu (which offers it) and the panel (which applies it) so a
// toggle left on in a genomic mode can't silently flip a cDNA readout.
export function modeSupportsRevcomp(mode: SequenceDisplayMode) {
  return sequenceModes[mode].revcomp
}

// genomic coordinates only make sense for continuous genome-based sequence
// types (not collapsed-intron or spliced views)
export function showGenomicCoordsOption(mode: SequenceDisplayMode) {
  return sequenceModes[mode].genomicCoords
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
