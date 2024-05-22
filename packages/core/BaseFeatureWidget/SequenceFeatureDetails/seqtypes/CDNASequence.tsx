import React from 'react'
import { observer } from 'mobx-react'

// locals
import { Feat } from '../../util'
import { cdsColor, updownstreamColor, utrColor } from '../util'
import { SequenceFeatureDetailsModel } from '../model'
import SequenceDisplay, { splitString } from './util'

const CDNASequence = observer(function ({
  utr,
  cds,
  exons,
  sequence,
  upstream,
  downstream,
  includeIntrons,
  collapseIntron,
  model,
}: {
  utr: Feat[]
  cds: Feat[]
  exons: Feat[]
  sequence: string
  upstream?: string
  downstream?: string
  includeIntrons?: boolean
  collapseIntron?: boolean
  model: SequenceFeatureDetailsModel
}) {
  const { upperCaseCDS, intronBp, width } = model
  const hasCds = cds.length > 0
  const chunks = (
    cds.length ? [...cds, ...utr].sort((a, b) => a.start - b.start) : exons
  ).filter(f => f.start !== f.end)
  const toLower = (s: string) => (upperCaseCDS ? s.toLowerCase() : s)
  const toUpper = (s: string) => (upperCaseCDS ? s.toUpperCase() : s)
  let currStart = 0
  let upstreamChunk = null as React.ReactNode
  let currRemainder = 0
  if (upstream) {
    const { segments, remainder } = splitString(toLower(upstream), width, 0)
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

  const middleChunks = [] as React.ReactNode[]
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]
    const intron = sequence.slice(chunk.end, chunks[idx + 1]?.start)
    const s = sequence.slice(chunk.start, chunk.end)
    const str0 = hasCds
      ? chunk.type === 'CDS'
        ? toUpper(s)
        : toLower(s)
      : toUpper(s)
    const { segments, remainder } = splitString(str0, width, currRemainder)
    currRemainder = remainder

    middleChunks.push(
      <SequenceDisplay
        key={JSON.stringify(chunk) + '-mid'}
        model={model}
        color={chunk.type === 'CDS' ? cdsColor : utrColor}
        start={currStart}
        chunks={segments}
      />,
    )
    currStart += str0.length

    if (intron && includeIntrons && idx < chunks.length - 1) {
      const str = toLower(
        collapseIntron && intron.length > intronBp * 2
          ? `${intron.slice(0, intronBp)}...${intron.slice(-intronBp)}`
          : intron,
      )
      const { segments, remainder } = splitString(str, width, currRemainder)

      if (segments.length) {
        currRemainder = remainder
        middleChunks.push(
          <SequenceDisplay
            key={JSON.stringify(chunk) + '-intron'}
            model={model}
            start={currStart}
            chunks={segments}
          />,
        )
        currStart += str.length
      }
    }
  }

  let downstreamChunk = null as React.ReactNode
  if (downstream) {
    const { segments, remainder } = splitString(
      toLower(downstream),
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
    <pre>
      {upstreamChunk}
      {middleChunks}
      {downstreamChunk}
    </pre>
  )
})

export default CDNASequence
