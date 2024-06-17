import React from 'react'
import { observer } from 'mobx-react'

// locals
import { Feat } from '../../util'
import { splitString, cdsColor, updownstreamColor, utrColor } from '../util'
import { SequenceFeatureDetailsModel } from '../model'
import SequenceDisplay from './SequenceDisplay'
import { SimpleFeatureSerialized } from '../../../util'

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

  const strand = feature.strand as number
  const fullGenomicCoordinates =
    showCoordinatesSetting === 'genomic' && includeIntrons && !collapseIntron

  let coordStart = fullGenomicCoordinates
    ? strand > 0
      ? feature.start + 1
      : feature.end
    : 0
  let currStart = 0
  let currRemainder = 0

  let upstreamChunk = null as React.ReactNode
  if (upstream) {
    coordStart = fullGenomicCoordinates
      ? strand > 0
        ? coordStart - upstream.length
        : coordStart + upstream.length
      : 0
    const { segments, remainder } = splitString({
      str: toLower(upstream),
      charactersPerRow,
      showCoordinates,
    })
    currRemainder = remainder
    upstreamChunk = (
      <SequenceDisplay
        model={model}
        color={updownstreamColor}
        strand={fullGenomicCoordinates ? strand : 1}
        start={currStart}
        coordStart={coordStart}
        chunks={segments}
      />
    )
    currStart = fullGenomicCoordinates
      ? strand > 0
        ? currStart + upstream.length
        : currStart - upstream.length
      : currStart + upstream.length
    coordStart = fullGenomicCoordinates
      ? strand > 0
        ? coordStart + upstream.length
        : coordStart - upstream.length
      : coordStart + upstream.length
  }

  const middleChunks = [] as React.ReactNode[]
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]
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
    currRemainder = remainder

    middleChunks.push(
      <SequenceDisplay
        key={JSON.stringify(chunk) + '-mid'}
        model={model}
        color={chunk.type === 'CDS' ? cdsColor : utrColor}
        strand={fullGenomicCoordinates ? strand : 1}
        start={currStart}
        coordStart={coordStart}
        chunks={segments}
      />,
    )
    currStart = fullGenomicCoordinates
      ? strand > 0
        ? currStart + s.length
        : currStart - s.length
      : currStart + s.length
    coordStart = fullGenomicCoordinates
      ? strand > 0
        ? coordStart + s.length
        : coordStart - s.length
      : coordStart + s.length

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
        currRemainder = remainder
        middleChunks.push(
          <SequenceDisplay
            key={JSON.stringify(chunk) + '-intron'}
            model={model}
            strand={fullGenomicCoordinates ? strand : 1}
            coordStart={coordStart}
            start={currStart}
            chunks={segments}
          />,
        )
        currStart = fullGenomicCoordinates
          ? strand > 0
            ? currStart + str.length
            : currStart - str.length
          : currStart + str.length
        coordStart = fullGenomicCoordinates
          ? strand > 0
            ? coordStart + str.length
            : coordStart - str.length
          : coordStart + str.length
      }
    }
  }

  let downstreamChunk = null as React.ReactNode
  if (downstream) {
    const { segments, remainder } = splitString({
      str: toLower(downstream),
      charactersPerRow,
      currRemainder,
      showCoordinates,
    })
    downstreamChunk = (
      <SequenceDisplay
        start={currStart}
        model={model}
        strand={fullGenomicCoordinates ? strand : 1}
        chunks={segments}
        coordStart={coordStart}
        color={updownstreamColor}
      />
    )
    currRemainder = remainder
    currStart = fullGenomicCoordinates
      ? strand > 0
        ? currStart - downstream.length
        : currStart + downstream.length
      : currStart + downstream.length
    coordStart = fullGenomicCoordinates
      ? strand > 0
        ? coordStart - downstream.length
        : coordStart + downstream.length
      : coordStart + downstream.length
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
