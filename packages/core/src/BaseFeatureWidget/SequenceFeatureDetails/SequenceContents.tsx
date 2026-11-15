import { observer } from 'mobx-react'

import { getGeneticCode } from '../../util/geneticCodes.ts'
import SimpleFeature from '../../util/simpleFeature.ts'
import {
  transcriptGeneticCodeId,
  transcriptTranslExcept,
} from '../../util/translateTranscript.ts'
import { resolveShowCoordinates } from './featureTypeUtil.ts'
import { getSequenceData } from './getSequenceData.ts'
import CDNASequence from './seqtypes/CDNASequence.tsx'
import CDSSequence from './seqtypes/CDSSequence.tsx'
import GenomicSequence from './seqtypes/GenomicSequence.tsx'
import ProteinSequence from './seqtypes/ProteinSequence.tsx'
import { sequenceModes } from './sequenceModes.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from './model.ts'
import type { SeqState } from './types.ts'

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
  const traits = sequenceModes[mode]
  const { seq, upstream, downstream, cds, exons } = getSequenceData({
    feature,
    sequence,
    revcomp,
  })
  const withUpDown = traits.upDownstream
  const useGenomicCoords =
    resolveShowCoordinates(model.showCoordinatesSetting, mode) === 'genomic'

  switch (traits.seqtype) {
    case 'genomic':
      return (
        <GenomicSequence
          model={model}
          feature={feature}
          sequence={seq}
          upstream={withUpDown ? upstream : undefined}
          downstream={withUpDown ? downstream : undefined}
          useGenomicCoords={useGenomicCoords}
          revcomp={revcomp}
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

    case 'cdna':
      return (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          sequence={seq}
          upstream={withUpDown ? upstream : undefined}
          downstream={withUpDown ? downstream : undefined}
          includeIntrons={traits.introns}
          collapseIntron={traits.collapsedIntrons}
          useGenomicCoords={useGenomicCoords}
          revcomp={revcomp}
          onHoverBase={onHoverBase}
        />
      )
  }
})

export default SequenceContents
