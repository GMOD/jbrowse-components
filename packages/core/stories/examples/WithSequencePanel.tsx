import React from 'react'
import { sequence, feature } from './util'
import SequencePanel from '.././../BaseFeatureWidget/SequenceFeatureDetails/SequencePanel'
import { SequenceFeatureDetailsF } from '.././../BaseFeatureWidget/SequenceFeatureDetails/model'

function GeneCollapsedIntronCoords() {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('relative')
  model.setMode('gene_collapsed_intron')
  return <SequencePanel model={model} sequence={sequence} feature={feature} />
}

function GeneCollapsedIntronNoCoords() {
  const model = SequenceFeatureDetailsF().create()
  model.setMode('gene_collapsed_intron')
  return <SequencePanel model={model} sequence={sequence} feature={feature} />
}

function CDSCoords() {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('relative')
  model.setMode('cds')
  return <SequencePanel model={model} sequence={sequence} feature={feature} />
}

function GeneCoordsGenomic() {
  const model = SequenceFeatureDetailsF().create()
  model.setShowCoordinates('genomic')
  model.setMode('gene')
  return <SequencePanel model={model} sequence={sequence} feature={feature} />
}

function CDSNoCoords() {
  const model = SequenceFeatureDetailsF().create()
  model.setMode('cds')
  return <SequencePanel model={model} sequence={sequence} feature={feature} />
}

export {
  CDSNoCoords,
  CDSCoords,
  GeneCoordsGenomic,
  GeneCollapsedIntronCoords,
  GeneCollapsedIntronNoCoords,
}
