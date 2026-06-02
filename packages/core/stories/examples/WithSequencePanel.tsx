import { feature, sequence } from './util.ts'
import SequencePanel from '../../src/BaseFeatureWidget/SequenceFeatureDetails/SequencePanel.tsx'
import { SequenceFeatureDetailsF } from '../../src/BaseFeatureWidget/SequenceFeatureDetails/model.ts'

function GeneCollapsedIntronCoords() {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('relative')
  return (
    <SequencePanel
      model={model}
      mode="gene_collapsed_intron"
      sequence={sequence}
      feature={feature}
    />
  )
}

function GeneCollapsedIntronNoCoords() {
  const model = SequenceFeatureDetailsF().create()
  return (
    <SequencePanel
      model={model}
      mode="gene_collapsed_intron"
      sequence={sequence}
      feature={feature}
    />
  )
}

function CDSCoords() {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('relative')
  return (
    <SequencePanel
      model={model}
      mode="cds"
      sequence={sequence}
      feature={feature}
    />
  )
}

function GeneCoordsGenomic() {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  return (
    <SequencePanel
      model={model}
      mode="gene"
      sequence={sequence}
      feature={feature}
    />
  )
}

function CDSNoCoords() {
  const model = SequenceFeatureDetailsF().create()
  return (
    <SequencePanel
      model={model}
      mode="cds"
      sequence={sequence}
      feature={feature}
    />
  )
}

export {
  CDSCoords,
  CDSNoCoords,
  GeneCollapsedIntronCoords,
  GeneCollapsedIntronNoCoords,
  GeneCoordsGenomic,
}
