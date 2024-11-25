import React from 'react'
import { observer } from 'mobx-react'

// locals
import { genomeColor, splitString, updownstreamColor } from '../util'
import SequenceDisplay from './SequenceDisplay'
import type { SimpleFeatureSerialized } from '../../../util'
import type { SequenceFeatureDetailsModel } from '../model'

const GenomicSequence = observer(function ({
  sequence,
  upstream,
  feature,
  downstream,
  model,
}: {
  sequence: string
  feature: SimpleFeatureSerialized
  upstream?: string
  downstream?: string
  model: SequenceFeatureDetailsModel
}) {
  const { charactersPerRow, showCoordinatesSetting, showCoordinates } = model
  let currStart = 0
  let upstreamChunk = null as React.ReactNode
  let currRemainder = 0
  const strand = feature.strand === -1 ? -1 : 1
  const fullGenomicCoordinates = showCoordinatesSetting === 'genomic'
  const mult = fullGenomicCoordinates ? strand : 1
  let coordStart = fullGenomicCoordinates
    ? strand > 0
      ? feature.start + 1 - (upstream?.length || 0)
      : feature.end + (upstream?.length || 0)
    : 0
  if (upstream) {
    const { segments, remainder } = splitString({
      str: upstream,
      charactersPerRow,
      showCoordinates,
    })
    upstreamChunk = (
      <SequenceDisplay
        model={model}
        color={updownstreamColor}
        start={currStart}
        coordStart={coordStart}
        chunks={segments}
      />
    )
    currRemainder = remainder
    currStart = currStart + upstream.length * mult
    coordStart = coordStart + upstream.length * mult
  }

  const { segments, remainder } = splitString({
    str: sequence,
    charactersPerRow,
    showCoordinates,
    currRemainder,
  })
  const middleChunk = (
    <SequenceDisplay
      model={model}
      color={genomeColor}
      start={currStart}
      coordStart={coordStart}
      chunks={segments}
    />
  )
  currRemainder = remainder
  currStart += sequence.length * mult
  coordStart = coordStart + sequence.length * mult

  let downstreamChunk = null as React.ReactNode
  if (downstream) {
    const { segments } = splitString({
      str: downstream,
      charactersPerRow,
      currRemainder,
      showCoordinates,
    })
    downstreamChunk = (
      <SequenceDisplay
        start={currStart}
        model={model}
        chunks={segments}
        coordStart={coordStart}
        color={updownstreamColor}
      />
    )
  }

  return (
    <>
      {upstreamChunk}
      {middleChunk}
      {downstreamChunk}
    </>
  )
})

export default GenomicSequence
