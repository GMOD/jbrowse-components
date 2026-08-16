import { observer } from 'mobx-react'

import {
  getGeneticCode,
  parseTranslTable,
  relativizeTranslExcept,
} from '../../util/geneticCodes.ts'
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

import type { TranslExcept } from '../../util/geneticCodes.ts'
import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { SeqState } from '../util.tsx'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
} from './model.ts'

function findCdsSubfeature(feature: SimpleFeatureSerialized) {
  return feature.subfeatures?.find(f => f.type?.toLowerCase() === 'cds')
}

// CDS-bound translation reads `transl_table` off the CDS subfeature (or the
// feature itself), so e.g. a mitochondrial gene translates with table 2 rather
// than the standard code. When the feature carries no transl_table (e.g. UCSC
// genePred-derived GFFs), fall back to the assembly-configured code for the
// contig. Undefined falls back to the standard code.
function proteinGeneticCode(
  feature: SimpleFeatureSerialized,
  assemblyGeneticCodeId: number | undefined,
) {
  const cds = findCdsSubfeature(feature)
  const id =
    parseTranslTable(feature.transl_table) ??
    parseTranslTable(cds?.transl_table) ??
    assemblyGeneticCodeId
  return getGeneticCode(id)
}

// Parses transl_except from the feature or its CDS subfeature into the coordinate
// system used by convertCodingSequenceToPeptides (feature-relative, reversed for
// minus-strand genes).
function featureTranslExcept(feature: SimpleFeatureSerialized): TranslExcept[] {
  const cds = findCdsSubfeature(feature)
  const raw = feature.transl_except ?? cds?.transl_except
  return raw
    ? relativizeTranslExcept({
        raw,
        featureStart: feature.start,
        featureLength: feature.end - feature.start,
        strand: feature.strand,
      })
    : []
}

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
      const translExcept = featureTranslExcept(feature)
      const code = proteinGeneticCode(feature, assemblyGeneticCodeId)
      return (
        <ProteinSequence
          model={model}
          cds={cds}
          sequence={seq}
          codonTable={code.codonTable}
          starts={code.starts}
          translExcept={translExcept.length ? translExcept : undefined}
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
