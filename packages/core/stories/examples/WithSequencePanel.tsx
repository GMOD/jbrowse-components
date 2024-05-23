import React from 'react'
import SequencePanel from '.././../BaseFeatureWidget/SequenceFeatureDetails/SequencePanel'
import { SequenceFeatureDetailsF } from '.././../BaseFeatureWidget/SequenceFeatureDetails/model'
import { sequence, feature } from './util'

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
  CDSNoCoords,
  CDSCoords,
  GeneCoordsGenomic,
  GeneCollapsedIntronCoords,
  GeneCollapsedIntronNoCoords,
}
