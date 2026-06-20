import { observer } from 'mobx-react'

import CDNASequence from './seqtypes/CDNASequence.tsx'
import CDSSequence from './seqtypes/CDSSequence.tsx'
import GenomicSequence from './seqtypes/GenomicSequence.tsx'
import ProteinSequence from './seqtypes/ProteinSequence.tsx'
import { getSequenceData } from './useSequenceData.ts'
import { getGeneticCode, parseTranslTable } from '../../util/geneticCodes.ts'

import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from './model.ts'
import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { Feat, SeqState } from '../util.tsx'

// CDS-bound translation reads `transl_table` off the CDS subfeature (or the
// feature itself), so e.g. a mitochondrial gene translates with table 2 rather
// than the standard code. When the feature carries no transl_table (e.g. UCSC
// genePred-derived GFFs), fall back to the assembly-configured code for the
// contig. Undefined falls back to the standard code.
function proteinCodonTable(
  feature: SimpleFeatureSerialized,
  assemblyGeneticCodeId: number | undefined,
) {
  const cds = feature.subfeatures?.find(f => f.type?.toLowerCase() === 'cds')
  const id =
    parseTranslTable(feature.transl_table) ??
    parseTranslTable(cds?.transl_table) ??
    assemblyGeneticCodeId
  return getGeneticCode(id).codonTable
}

function RenderedSequenceComponent({
  mode,
  feature,
  model,
  assemblyGeneticCodeId,
  sequenceData,
}: {
  mode: SequenceDisplayMode
  feature: SimpleFeatureSerialized
  model: SequenceFeatureDetailsModel
  assemblyGeneticCodeId?: number
  sequenceData: {
    seq: string
    upstream?: string
    downstream?: string
    cds: Feat[]
    exons: Feat[]
    utr: Feat[]
  }
}) {
  const { seq, upstream, downstream, cds, exons, utr } = sequenceData
  const withUpDown = mode.includes('updownstream')

  switch (mode) {
    case 'genomic':
    case 'genomic_sequence_updownstream':
      return (
        <GenomicSequence
          model={model}
          feature={feature}
          sequence={seq}
          upstream={withUpDown ? upstream : undefined}
          downstream={withUpDown ? downstream : undefined}
        />
      )

    case 'cds':
      return <CDSSequence model={model} cds={cds} sequence={seq} />

    case 'protein':
      return (
        <ProteinSequence
          model={model}
          cds={cds}
          sequence={seq}
          codonTable={proteinCodonTable(feature, assemblyGeneticCodeId)}
        />
      )

    // cdna and the gene_* variants all render the spliced transcript; introns
    // and up/downstream flanks are toggled by the mode name
    case 'cdna':
    case 'gene':
    case 'gene_collapsed_intron':
    case 'gene_updownstream':
    case 'gene_updownstream_collapsed_intron':
      return (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          utr={utr}
          sequence={seq}
          upstream={withUpDown ? upstream : undefined}
          downstream={withUpDown ? downstream : undefined}
          includeIntrons={mode.startsWith('gene')}
          collapseIntron={mode.includes('collapsed_intron')}
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
  assemblyGeneticCodeId,
}: {
  mode: SequenceDisplayMode
  feature: SimpleFeatureSerialized
  sequence: SeqState
  model: SequenceFeatureDetailsModel
  assemblyGeneticCodeId?: number
}) {
  const sequenceData = getSequenceData({
    feature,
    sequence,
  })
  return sequenceData ? (
    <RenderedSequenceComponent
      mode={mode}
      feature={feature}
      model={model}
      assemblyGeneticCodeId={assemblyGeneticCodeId}
      sequenceData={sequenceData}
    />
  ) : null
})

export default SequenceContents
