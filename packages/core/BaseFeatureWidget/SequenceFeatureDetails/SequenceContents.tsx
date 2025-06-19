import { observer } from 'mobx-react'

import { defaultCodonTable, generateCodonTable, revcom } from '../../util'
import { calculateUTRs2, calculateUTRs, dedupe, revlist } from '../util'
import CDNASequence from './seqtypes/CDNASequence'
import CDSSequence from './seqtypes/CDSSequence'
import GenomicSequence from './seqtypes/GenomicSequence'
import ProteinSequence from './seqtypes/ProteinSequence'

import type { SequenceFeatureDetailsModel } from './model'
import type { SimpleFeatureSerialized } from '../../util'
import type { SeqState } from '../util'

/**
 * Prepares feature subfeatures for display by sorting and adjusting coordinates
 * relative to the parent feature start position
 */
function prepareSubfeatures(feature: SimpleFeatureSerialized) {
  const { start, subfeatures } = feature
  return (
    subfeatures
      ?.sort((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - start,
        end: sub.end - start,
      })) || []
  )
}

/**
 * Processes feature data to extract and deduplicate CDS, UTR, and exon features
 */
function processFeatureData(children: any[], feature: SimpleFeatureSerialized) {
  // Filter duplicate entries in cds and exon lists
  // Duplicate entries may be rare but were seen in Gencode v36 track NCList
  // (produces broken protein translations if included)
  const cds = dedupe(children.filter(sub => sub.type?.toLowerCase() === 'cds'))
  const exons = dedupe(children.filter(sub => sub.type === 'exon'))
  let utr = dedupe(children.filter(sub => sub.type?.match(/utr/i)))

  // Calculate UTRs if not present but we have CDS and exons
  if (!utr.length && cds.length && exons.length) {
    utr = calculateUTRs(cds, exons)
  } else if (!utr.length && cds.length && !exons.length) {
    utr = calculateUTRs2(cds, {
      start: 0,
      end: feature.end - feature.start,
      type: 'gene',
    })
  }

  return {
    cds,
    exons,
    utr,
  }
}

/**
 * Handles sequence orientation for reverse strand features
 */
interface FeatureData {
  sequence: SeqState
  cds: any[]
  exons: any[]
  utr: any[]
}

function handleReverseStrand(
  sequence: SeqState,
  cds: any[],
  exons: any[],
  utr: any[],
): FeatureData {
  const { seq, upstream = '', downstream = '' } = sequence

  // For reverse strand, reverse complement the sequence and swap upstream/downstream
  if (seq) {
    return {
      sequence: {
        seq: revcom(seq),
        upstream: downstream ? revcom(downstream) : '',
        downstream: upstream ? revcom(upstream) : '',
      },
      cds: revlist(cds, seq.length),
      exons: revlist(exons, seq.length),
      utr: revlist(utr, seq.length),
    }
  }

  return { sequence, cds, exons, utr }
}

/**
 * Renders the appropriate sequence component based on the selected mode
 */
function RenderedSequenceComponent({
  mode,
  feature,
  model,
  sequenceData,
}: {
  mode: string
  feature: SimpleFeatureSerialized
  model: SequenceFeatureDetailsModel
  sequenceData: {
    seq: string
    upstream?: string
    downstream?: string
    cds: any[]
    exons: any[]
    utr: any[]
  }
}) {
  const { seq, upstream, downstream, cds, exons, utr } = sequenceData

  switch (mode) {
    case 'genomic':
      return <GenomicSequence feature={feature} model={model} sequence={seq} />

    case 'genomic_sequence_updownstream':
      return (
        <GenomicSequence
          model={model}
          feature={feature}
          sequence={seq}
          upstream={upstream}
          downstream={downstream}
        />
      )

    case 'cds':
      return <CDSSequence model={model} cds={cds} sequence={seq} />

    case 'cdna':
      return (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          utr={utr}
          sequence={seq}
        />
      )

    case 'protein':
      return (
        <ProteinSequence
          model={model}
          cds={cds}
          codonTable={generateCodonTable(defaultCodonTable)}
          sequence={seq}
        />
      )

    case 'gene':
      return (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          utr={utr}
          sequence={seq}
          includeIntrons
        />
      )

    case 'gene_collapsed_intron':
      return (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          sequence={seq}
          utr={utr}
          includeIntrons
          collapseIntron
        />
      )

    case 'gene_updownstream':
      return (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          sequence={seq}
          utr={utr}
          upstream={upstream}
          downstream={downstream}
          includeIntrons
        />
      )

    case 'gene_updownstream_collapsed_intron':
      return (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          sequence={seq}
          utr={utr}
          upstream={upstream}
          downstream={downstream}
          includeIntrons
          collapseIntron
        />
      )

    default:
      return <div>Unknown type</div>
  }
}

const SequenceContents = observer(function ({
  mode,
  feature,
  sequence,
  model,
}: {
  mode: string
  feature: SimpleFeatureSerialized
  sequence: SeqState
  model: SequenceFeatureDetailsModel
}) {
  // Prepare subfeatures relative to parent feature start position
  const children = prepareSubfeatures(feature)

  // Process feature data to extract CDS, exons, and UTRs
  const { cds, exons, utr } = processFeatureData(children, feature)

  // Handle reverse strand orientation if needed
  const {
    sequence: adjustedSequence,
    cds: adjustedCds,
    exons: adjustedExons,
    utr: adjustedUtr,
  } = feature.strand === -1
    ? handleReverseStrand(sequence, cds, exons, utr)
    : { sequence, cds, exons, utr }

  const { seq, upstream, downstream } = adjustedSequence

  // Create sequence data object for rendering
  const sequenceData = {
    seq,
    upstream,
    downstream,
    cds: adjustedCds,
    exons: adjustedExons,
    utr: adjustedUtr,
  }

  return (
    <RenderedSequenceComponent
      mode={mode}
      feature={feature}
      model={model}
      sequenceData={sequenceData}
    />
  )
})

export default SequenceContents
