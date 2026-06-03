import { observer } from 'mobx-react'

import { cdsColor, updownstreamColor, utrColor } from '../consts.ts'
import { computeCoordProps, getIntronDisplayStr, splitString } from '../util.ts'
import SequenceDisplay from './SequenceDisplay.tsx'

import type { SimpleFeatureSerialized } from '../../../util/index.ts'
import type { Feat } from '../../util.tsx'
import type { SequenceFeatureDetailsModel } from '../model.ts'

const CDNASequence = observer(function CDNASequence({
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

  const { mult, coordStart: initialCoordStart } = computeCoordProps(
    feature,
    showCoordinatesSetting === 'genomic' && !!includeIntrons && !collapseIntron,
    upstream,
  )
  let coordStart = initialCoordStart
  let currStart = 0
  let currRemainder = 0

  let upstreamChunk: React.ReactNode = null
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

  const middleChunks: React.ReactNode[] = []
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx]!
    const intron = sequence.slice(chunk.end, chunks[idx + 1]?.start)
    const s = sequence.slice(chunk.start, chunk.end)
    // uppercase CDS (and whole-exon chunks when there's no CDS); lowercase UTR
    const { segments, remainder } = splitString({
      str: chunk.type === 'CDS' || !hasCds ? toUpper(s) : toLower(s),
      charactersPerRow,
      currRemainder,
      showCoordinates,
    })

    middleChunks.push(
      <SequenceDisplay
        key={`${chunk.start}-${chunk.end}-${chunk.type}-mid`}
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
        getIntronDisplayStr(intron, intronBp, collapseIntron ?? false),
      )
      const { segments: intronSegments, remainder: intronRemainder } =
        splitString({
          str,
          charactersPerRow,
          currRemainder,
          showCoordinates,
        })

      if (intronSegments.length) {
        middleChunks.push(
          <SequenceDisplay
            key={`${chunk.start}-${chunk.end}-${chunk.type}-intron`}
            model={model}
            strand={mult}
            coordStart={coordStart}
            start={currStart}
            chunks={intronSegments}
          />,
        )
        currRemainder = intronRemainder
        currStart = currStart + str.length * mult
        coordStart = coordStart + str.length * mult
      }
    }
  }

  let downstreamChunk: React.ReactNode = null
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
