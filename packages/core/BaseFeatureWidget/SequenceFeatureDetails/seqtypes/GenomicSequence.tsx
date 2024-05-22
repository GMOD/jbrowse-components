import React from 'react'
import { observer } from 'mobx-react'

// locals
import { genomeColor, splitString, updownstreamColor } from '../util'
import { SequenceFeatureDetailsModel } from '../model'
import SequenceDisplay from './SequenceDisplay'

const GenomicSequence = observer(function ({
  sequence,
  upstream,
  downstream,
  model,
}: {
  sequence: string
  upstream?: string
  downstream?: string
  model: SequenceFeatureDetailsModel
}) {
  const { width } = model
  let currStart = 0
  let upstreamChunk = null as React.ReactNode
  let currRemainder = 0

  if (upstream) {
    const { segments, remainder } = splitString(upstream, width, 0)
    currRemainder = remainder
    upstreamChunk = (
      <SequenceDisplay
        model={model}
        color={updownstreamColor}
        start={currStart}
        chunks={segments}
      />
    )
    currStart += upstream.length
  }

  const { segments, remainder } = splitString(sequence, width, 0)
  currRemainder = remainder
  const middleChunk = (
    <SequenceDisplay
      model={model}
      color={genomeColor}
      start={currStart}
      chunks={segments}
    />
  )
  currStart += sequence.length

  let downstreamChunk = null as React.ReactNode
  if (downstream) {
    const { segments, remainder } = splitString(
      downstream,
      width,
      currRemainder,
    )
    downstreamChunk = (
      <SequenceDisplay
        start={currStart}
        model={model}
        chunks={segments}
        color={updownstreamColor}
      />
    )
    currRemainder = remainder
    currStart += downstream.length
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
