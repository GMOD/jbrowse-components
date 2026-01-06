import { observer } from 'mobx-react'

import CDNASequence from './seqtypes/CDNASequence.tsx'
import CDSSequence from './seqtypes/CDSSequence.tsx'
import GenomicSequence from './seqtypes/GenomicSequence.tsx'
import ProteinSequence from './seqtypes/ProteinSequence.tsx'
import { useSequenceData } from './useSequenceData.ts'
import { defaultCodonTable, generateCodonTable } from '../../util/index.ts'

import type { SequenceFeatureDetailsModel } from './model.ts'
import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { SeqState } from '../util.tsx'

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

const SequenceContents = observer(function SequenceContents({
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
  const sequenceData = useSequenceData({
    feature,
    sequence,
  })
  return sequenceData ? (
    <RenderedSequenceComponent
      mode={mode}
      feature={feature}
      model={model}
      sequenceData={sequenceData}
    />
  ) : null
})

export default SequenceContents
