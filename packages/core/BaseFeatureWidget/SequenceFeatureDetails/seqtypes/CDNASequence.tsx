import React from 'react'
import { observer } from 'mobx-react'

// locals
import { Feat } from '../../util'
import { cdsColor, intronColor, updownstreamColor, utrColor } from '../util'
import { SequenceFeatureDetailsModel } from '../model'

function splitString(str: string, size: number, initial: number) {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)

  let counter = 0
  for (let i = 0, o = 0; i < numChunks; ++i, o += size, counter++) {
    chunks[i] = str.slice(o, o + (i === 0 ? size - initial : size))
  }

  return {
    segments: chunks,
    remainder:
      (chunks.at(-1)?.length % size || 0) + (counter < 2 ? initial : 0),
  }
}
function SplitString({
  chunks,
  size,
  start,
}: {
  chunks: string[]
  size: number
  start: number
}) {
  return chunks.map((s, idx) => (
    <React.Fragment key={s + '-' + idx}>
      {`${start + idx * size}`.padStart(4)} {s}
      {idx === chunks.length - 1 && chunks.at(-1)?.length !== size ? null : (
        <br />
      )}
    </React.Fragment>
  ))
}

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
  const { upperCaseCDS, intronBp } = model
  const hasCds = cds.length > 0
  const chunks = (
    cds.length ? [...cds, ...utr].sort((a, b) => a.start - b.start) : exons
  ).filter(f => f.start !== f.end)
  const toLower = (s: string) => (upperCaseCDS ? s.toLowerCase() : s)
  const toUpper = (s: string) => (upperCaseCDS ? s.toUpperCase() : s)
  let currStart = 0
  const width = 100
  let upstreamChunk = null as React.ReactNode
  let currRemainder = 0
  if (upstream) {
    const { segments: upstreamSegments, remainder } = splitString(
      toLower(upstream),
      width,
      0,
    )
    upstreamChunk = (
      <span style={{ background: updownstreamColor }}>
        <SplitString start={currStart} chunks={upstreamSegments} size={width} />
      </span>
    )
    currRemainder = remainder
    currStart += upstream.length
  }

  console.log({ chunks })
  const middleChunks = [] as React.ReactNode[]
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]
    const intron = sequence.slice(chunk.end, chunks[idx + 1]?.start)
    const cseq = sequence.slice(chunk.start, chunk.end)
    const { segments, remainder } = splitString(
      hasCds
        ? chunk.type === 'CDS'
          ? toUpper(cseq)
          : toLower(cseq)
        : toUpper(cseq),
      width,
      currRemainder,
    )
    currRemainder = remainder

    middleChunks.push(
      <span
        key={JSON.stringify(chunk) + '-mid'}
        style={{ background: chunk.type === 'CDS' ? cdsColor : utrColor }}
      >
        <SplitString start={currStart} chunks={segments} size={width} />
      </span>,
    )
    currStart += cseq.length
    if (intron && includeIntrons && idx < chunks.length - 1) {
      const { segments: intronSegments, remainder } = splitString(
        toLower(
          collapseIntron && intron.length > intronBp * 2
            ? `${intron.slice(0, intronBp)}...${intron.slice(-intronBp)}`
            : intron,
        ),
        width,
        currRemainder,
      )

      if (intronSegments.length) {
        currRemainder = remainder
        middleChunks.push(
          <span
            key={JSON.stringify(chunk) + '-intron'}
            style={{ background: intronColor }}
          >
            <SplitString
              start={currStart}
              chunks={intronSegments}
              size={width}
            />
          </span>,
        )
        currStart += intron.length
      }
    }
  }

  let downstreamChunk = null as React.ReactNode
  if (downstream) {
    const { segments: downstreamSegments, remainder } = splitString(
      toLower(downstream),
      width,
      currRemainder,
    )
    downstreamChunk = (
      <span style={{ background: updownstreamColor }}>
        <SplitString
          start={currStart}
          chunks={downstreamSegments}
          size={width}
        />
      </span>
    )
    currRemainder = remainder
    currStart += downstream.length
  }
  return (
    <>
      {upstreamChunk}
      {middleChunks}
      {downstreamChunk}
    </>
  )
})

export default CDNASequence
