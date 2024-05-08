import React from 'react'
import { observer } from 'mobx-react'

// locals
import { Feat } from '../../util'
import { cdsColor, intronColor, updownstreamColor, utrColor } from '../util'
import { SequenceFeatureDetailsModel } from '../model'

function splitString(str: string, size: number, initial: number) {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.slice(o, o + (i === 0 ? size - initial : size))
  }

  return { segments: chunks, remainder: chunks.at(-1)?.length || 0 }
}
function SplitString({ chunks }: { chunks: string[] }) {
  return chunks.map((s, idx) => (
    <React.Fragment key={s + '-' + idx}>
      {s}
      {idx === chunks.length - 1 ? null : <br />}
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
        <SplitString chunks={upstreamSegments} />
      </span>
    )
    currRemainder = remainder
  }
  const middleChunks = [] as React.ReactNode[]
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]
    const intron = sequence.slice(chunk.end, chunks[idx + 1]?.start)
    const { segments, remainder } = splitString(
      hasCds
        ? chunk.type === 'CDS'
          ? toUpper(sequence.slice(chunk.start, chunk.end))
          : toLower(sequence.slice(chunk.start, chunk.end))
        : toUpper(sequence.slice(chunk.start, chunk.end)),
      width,
      currRemainder,
    )
    currRemainder = remainder

    middleChunks.push(
      <span
        key={JSON.stringify(chunk) + '-mid'}
        style={{ background: chunk.type === 'CDS' ? cdsColor : utrColor }}
      >
        <SplitString chunks={segments} />
      </span>,
    )
    if (includeIntrons && idx < chunks.length - 1) {
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
            <SplitString chunks={intronSegments} />
          </span>,
        )
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
        <SplitString chunks={downstreamSegments} />
      </span>
    )
    currRemainder = remainder
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
