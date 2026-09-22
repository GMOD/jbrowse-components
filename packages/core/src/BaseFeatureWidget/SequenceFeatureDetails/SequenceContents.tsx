import { observer } from 'mobx-react'

import { getGeneticCode } from '../../util/geneticCodes.ts'
import SimpleFeature from '../../util/simpleFeature.ts'
import {
  transcriptGeneticCodeId,
  transcriptTranslExcept,
} from '../../util/translateTranscript.ts'
import {
  modeHasUpDownstream,
  modeSupportsRevcomp,
  resolveShowCoordinates,
} from './featureTypeUtil.ts'
import CDNASequence from './seqtypes/CDNASequence.tsx'
import CDSSequence from './seqtypes/CDSSequence.tsx'
import GenomicSequence from './seqtypes/GenomicSequence.tsx'
import ProteinSequence from './seqtypes/ProteinSequence.tsx'
import { getSequenceData } from './useSequenceData.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { SeqState } from '../util.tsx'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from './model.ts'

// Dispatches to the renderer for the current sequence type. An observer because
// it reads showCoordinatesSetting: that setting moving relative<->genomic
// leaves the coarse showCoordinates boolean every other observer here reads
// untouched, so as a plain component this kept rendering the old coordinates
// while the menu radio said otherwise.
const SequenceContents = observer(function SequenceContents({
  mode,
  feature,
  sequence,
  model,
  assemblyGeneticCodeId,
  revcomp,
  onHoverBase,
}: {
  mode: SequenceDisplayMode
  feature: SimpleFeatureSerialized
  sequence: SeqState
  model: SequenceFeatureDetailsModel
  assemblyGeneticCodeId?: number
  revcomp: boolean
  onHoverBase?: (base0: number) => void
}) {
  // revcomp is offered for the genomic types only, so a toggle left on in one
  // of those can't flip a spliced readout when the user switches type
  const rc = revcomp && modeSupportsRevcomp(mode)
  const { seq, upstream, downstream, cds, exons } = getSequenceData({
    feature,
    sequence,
    revcomp: rc,
  })
  const withUpDown = modeHasUpDownstream(mode)
  const useGenomicCoords =
    resolveShowCoordinates(model.showCoordinatesSetting, mode) === 'genomic'

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
          useGenomicCoords={useGenomicCoords}
          revcomp={rc}
          onHoverBase={onHoverBase}
        />
      )

    case 'cds':
      return <CDSSequence model={model} cds={cds} sequence={seq} />

    case 'protein': {
      const transcript = new SimpleFeature(feature)
      const translExcept = transcriptTranslExcept(transcript)
      const code = getGeneticCode(
        transcriptGeneticCodeId(transcript, assemblyGeneticCodeId),
      )
      return (
        <ProteinSequence
          model={model}
          cds={cds}
          sequence={seq}
          codonTable={code.codonTable}
          starts={code.starts}
          translExcept={translExcept?.length ? translExcept : undefined}
        />
      )
    }

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
          sequence={seq}
          upstream={withUpDown ? upstream : undefined}
          downstream={withUpDown ? downstream : undefined}
          includeIntrons={mode.startsWith('gene')}
          collapseIntron={mode.includes('collapsed_intron')}
          useGenomicCoords={useGenomicCoords}
          revcomp={rc}
          onHoverBase={onHoverBase}
        />
      )

    default:
      return <div>Unknown type</div>
  }
})

export default SequenceContents
