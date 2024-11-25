import React from 'react'
import { observer } from 'mobx-react'

// locals
import { splitString, cdsColor, updownstreamColor, utrColor } from '../util'
import SequenceDisplay from './SequenceDisplay'
import type { SimpleFeatureSerialized } from '../../../util'
import type { Feat } from '../../util'
import type { SequenceFeatureDetailsModel } from '../model'

const CDNASequence = observer(function ({
  utr,
  cds,
  exons,
  sequence,
  upstream,
  downstream,
  feature,
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
  feature: SimpleFeatureSerialized
  includeIntrons?: boolean
  collapseIntron?: boolean
  model: SequenceFeatureDetailsModel
}) {
  const {
    upperCaseCDS,
    intronBp,
    charactersPerRow,
    showCoordinates,
    showCoordinatesSetting,
  } = model
  const hasCds = cds.length > 0
  const chunks = (
    cds.length ? [...cds, ...utr].sort((a, b) => a.start - b.start) : exons
  ).filter(f => f.start !== f.end)
  const toLower = (s: string) => (upperCaseCDS ? s.toLowerCase() : s)
  const toUpper = (s: string) => (upperCaseCDS ? s.toUpperCase() : s)

  const strand = feature.strand === -1 ? -1 : 1
  const fullGenomicCoordinates =
    showCoordinatesSetting === 'genomic' && includeIntrons && !collapseIntron

  const mult = fullGenomicCoordinates ? strand : 1
  let coordStart = fullGenomicCoordinates
    ? strand > 0
      ? feature.start + 1 - (upstream?.length || 0)
      : feature.end + (upstream?.length || 0)
    : 0
  let currStart = 0
  let currRemainder = 0

  let upstreamChunk = null as React.ReactNode
  if (upstream) {
    const { segments, remainder } = splitString({
      str: toLower(upstream),
      charactersPerRow,
      showCoordinates,
    })
    upstreamChunk = (
      <SequenceDisplay
        model={model}
        color={updownstreamColor}
        strand={mult}
        start={currStart}
        coordStart={coordStart}
        chunks={segments}
      />
    )
    currRemainder = remainder
    currStart = currStart + upstream.length * mult
    coordStart = coordStart + upstream.length * mult
  }

  const middleChunks = [] as React.ReactNode[]
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]!
    const intron = sequence.slice(chunk.end, chunks[idx + 1]?.start)
    const s = sequence.slice(chunk.start, chunk.end)
    const { segments, remainder } = splitString({
      str: hasCds
        ? chunk.type === 'CDS'
          ? toUpper(s)
          : toLower(s)
        : toUpper(s),
      charactersPerRow,
      currRemainder,
      showCoordinates,
    })

    middleChunks.push(
      <SequenceDisplay
        key={`${JSON.stringify(chunk)}-mid`}
        model={model}
        color={chunk.type === 'CDS' ? cdsColor : utrColor}
        strand={mult}
        start={currStart}
        coordStart={coordStart}
        chunks={segments}
      />,
    )
    currRemainder = remainder
    currStart = currStart + s.length * mult
    coordStart = coordStart + s.length * mult

    if (intron && includeIntrons && idx < chunks.length - 1) {
      const str = toLower(
        collapseIntron && intron.length > intronBp * 2
          ? `${intron.slice(0, intronBp)}...${intron.slice(-intronBp)}`
          : intron,
      )
      const { segments, remainder } = splitString({
        str,
        charactersPerRow,
        currRemainder,
        showCoordinates,
      })

      if (segments.length) {
        middleChunks.push(
          <SequenceDisplay
            key={`${JSON.stringify(chunk)}-intron`}
            model={model}
            strand={mult}
            coordStart={coordStart}
            start={currStart}
            chunks={segments}
          />,
        )
        currRemainder = remainder
        currStart = currStart + str.length * mult
        coordStart = coordStart + str.length * mult
      }
    }
  }

  let downstreamChunk = null as React.ReactNode
  if (downstream) {
    const { segments } = splitString({
      str: toLower(downstream),
      charactersPerRow,
      currRemainder,
      showCoordinates,
    })
    downstreamChunk = (
      <SequenceDisplay
        start={currStart}
        model={model}
        strand={mult}
        chunks={segments}
        coordStart={coordStart}
        color={updownstreamColor}
      />
    )
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
