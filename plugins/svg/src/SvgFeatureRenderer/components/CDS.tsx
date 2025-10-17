import React from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { colord } from '@jbrowse/core/util/colord'
import { darken, lighten, useTheme } from '@mui/material'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { observer } from 'mobx-react'

import Arrow from './Arrow'
import { getBoxColor } from './getBoxColor'
import { usePeptides } from '../hooks/usePeptides'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

interface AggregatedAminoAcid {
  aminoAcid: string
  startIndex: number
  endIndex: number
  length: number
  proteinIndex: number
}

function aggregateContiguousAminoAcids(
  protein: string,
  g2p: Record<string, number>,
  featureStart: number,
  featureEnd: number,
  strand: number,
): AggregatedAminoAcid[] {
  const aggregated: AggregatedAminoAcid[] = []
  const len = featureEnd - featureStart

  let currentElt: number | undefined = undefined
  let currentAminoAcid: string | null = null
  let startIndex = 0
  let idx = 0

  for (let i = 0; i < len; i++) {
    const pos = strand === -1 ? featureEnd - i : featureStart + i
    const elt = g2p[pos]!
    const aminoAcid = protein[elt] ?? '&'

    if (currentElt === undefined) {
      currentElt = elt
      currentAminoAcid = aminoAcid
      startIndex = idx
    } else if (currentElt !== elt) {
      aggregated.push({
        aminoAcid: currentAminoAcid!,
        startIndex,
        endIndex: idx - 1,
        length: idx - startIndex,
        proteinIndex: currentElt,
      })
      currentElt = elt
      currentAminoAcid = aminoAcid
      startIndex = idx
    }

    idx++
  }

  if (currentAminoAcid !== null) {
    aggregated.push({
      aminoAcid: currentAminoAcid,
      startIndex,
      endIndex: idx - 1,
      length: idx - startIndex,
      proteinIndex: currentElt!,
    })
  }

  return aggregated
}

const CDS = observer(function CDS(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: SceneGraph
  bpPerPx: number
  selected?: boolean
  topLevel?: boolean
  colorByCDS: boolean
  displayModel: any
}) {
  const theme = useTheme()
  const {
    colorByCDS,
    feature,
    region,
    config,
    featureLayout,
    bpPerPx,
    topLevel,
    displayModel,
  } = props
  const { start, end, reversed } = region
  const screenWidth = Math.ceil((end - start) / bpPerPx)
  const featureStart = feature.get('start')
  const flipper = reversed ? -1 : 1
  const featureEnd = feature.get('end')
  const strand = feature.get('strand')
  const width = (featureEnd - featureStart) / bpPerPx
  const { left = 0, top = 0, right = 0, height = 0 } = featureLayout.absolute
  const zoomedInEnough = 1 / bpPerPx >= 10
  const dontRenderRect = left + width < 0 || left > screenWidth
  const dontRenderLetters = !zoomedInEnough
  const doRender = !dontRenderLetters && !dontRenderRect && colorByCDS
  const leftWithinBlock = Math.max(left, 0)
  const diff = leftWithinBlock - left
  const widthWithinBlock = Math.max(2, Math.min(width - diff, screenWidth))
  const parent = feature.parent() ?? feature
  const protein = usePeptides({
    feature: parent,
    region,
    displayModel,
    shouldFetch: doRender,
  })
  const g2p = doRender
    ? // @ts-expect-error
      genomeToTranscriptSeqMapping(parent.toJSON()).g2p
    : undefined

  const elements: React.ReactElement[] = []
  if (g2p && protein && doRender) {
    const aggregatedAminoAcids = aggregateContiguousAminoAcids(
      protein,
      g2p,
      featureStart,
      featureEnd,
      strand,
    )

    const baseColor = getBoxColor({
      feature,
      config,
      colorByCDS,
      theme,
    })

    for (let index = 0, l = aggregatedAminoAcids.length; index < l; index++) {
      const aa = aggregatedAminoAcids[index]!
      const centerIndex = Math.floor((aa.startIndex + aa.endIndex) / 2)
      const isNonTriplet = aa.length % 3 !== 0 || aa.aminoAcid === '&'
      const fillColor = isNonTriplet ? 'red' : 'black'

      const isAlternate = index % 2 === 1
      const bgColor = isAlternate
        ? darken(colord(baseColor).toHex(), 0.1)
        : lighten(colord(baseColor).toHex(), 0.2)

      if (strand * flipper === -1) {
        const startX = right - (1 / bpPerPx) * aa.startIndex
        const endX = right - (1 / bpPerPx) * (aa.endIndex + 1)
        const x = (startX + endX) / 2
        const rectWidth = startX - endX

        elements.push(
          <rect
            key={`${index}-bg-${aa.aminoAcid}-${aa.startIndex}-${aa.endIndex}`}
            x={endX}
            y={top}
            width={rectWidth}
            height={height}
            fill={bgColor}
            stroke="none"
          />,
          <text
            key={`${index}-${aa.aminoAcid}-${aa.startIndex}-${aa.endIndex}`}
            x={x}
            y={top + height - 1}
            fontSize={height}
            fill={fillColor}
            textAnchor="middle"
          >
            {isNonTriplet || aa.aminoAcid === '*' || aa.aminoAcid === '&'
              ? aa.aminoAcid
              : `${aa.aminoAcid}${aa.proteinIndex + 1}`}
          </text>,
        )
      } else {
        const x = left + (1 / bpPerPx) * centerIndex + 1 / bpPerPx / 2
        const startX = left + (1 / bpPerPx) * aa.startIndex
        const endX = left + (1 / bpPerPx) * (aa.endIndex + 1)
        const rectWidth = endX - startX

        elements.push(
          <rect
            key={`${index}-bg-${aa.aminoAcid}-${aa.startIndex}-${aa.endIndex}`}
            x={startX}
            y={top}
            width={rectWidth}
            height={height}
            fill={bgColor}
            stroke="none"
          />,
          <text
            key={`${index}-${aa.aminoAcid}-${aa.startIndex}-${aa.endIndex}`}
            x={x}
            y={top + height - 1}
            fontSize={height}
            fill={fillColor}
            textAnchor="middle"
          >
            {isNonTriplet || aa.aminoAcid === '*' || aa.aminoAcid === '&'
              ? aa.aminoAcid
              : `${aa.aminoAcid}${aa.proteinIndex + 1}`}
          </text>,
        )
      }
    }
  }

  return dontRenderRect ? null : (
    <>
      {topLevel ? <Arrow {...props} /> : null}
      <rect
        data-testid={`box-${feature.id()}`}
        x={leftWithinBlock}
        y={top}
        width={widthWithinBlock}
        height={height}
        fill={getBoxColor({
          feature,
          config,
          colorByCDS,
          theme,
        })}
        stroke={readConfObject(config, 'outline', { feature }) as string}
      />
      {elements}
    </>
  )
})

export default CDS
