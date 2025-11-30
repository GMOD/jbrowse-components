import React from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { colord } from '@jbrowse/core/util/colord'
import { darken, lighten, useTheme } from '@mui/material'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { observer } from 'mobx-react'

import Arrow from './Arrow'
import { aggregateAminos } from './aggregateAminos'
import { getBoxColor } from './util'
import { usePeptides } from '../hooks/usePeptides'

import type { DisplayModel, FeatureLayout, RenderConfigContext } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const CDS = observer(function CDS(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  featureLayout: FeatureLayout
  bpPerPx: number
  topLevel?: boolean
  colorByCDS: boolean
  displayModel?: DisplayModel
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
  const { x: left, y: top, height } = featureLayout
  const right = left + featureLayout.width
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

  const fill = getBoxColor({ feature, config, colorByCDS, theme })
  const elements: React.ReactElement[] = []
  const isReverse = strand * flipper === -1
  const pxPerBp = 1 / bpPerPx

  if (g2p && protein && doRender) {
    const aggregatedAminoAcids = aggregateAminos(protein, g2p, featureStart, featureEnd, strand)
    const fillHex = colord(fill).toHex()

    for (let index = 0, l = aggregatedAminoAcids.length; index < l; index++) {
      const aa = aggregatedAminoAcids[index]!
      const isNonTriplet = aa.length % 3 !== 0 || aa.aminoAcid === '&'
      const bgColor = index % 2 === 1 ? darken(fillHex, 0.1) : lighten(fillHex, 0.2)

      const rectX = isReverse
        ? right - pxPerBp * (aa.endIndex + 1)
        : left + pxPerBp * aa.startIndex
      const rectWidth = pxPerBp * (aa.endIndex - aa.startIndex + 1)
      const textX = isReverse
        ? right - pxPerBp * (aa.startIndex + aa.endIndex + 1) / 2
        : left + pxPerBp * ((aa.startIndex + aa.endIndex) / 2 + 0.5)

      const label =
        isNonTriplet || aa.aminoAcid === '*' || aa.aminoAcid === '&'
          ? aa.aminoAcid
          : `${aa.aminoAcid}${aa.proteinIndex + 1}`

      elements.push(
        <rect
          key={`${index}-bg`}
          x={rectX}
          y={top}
          width={rectWidth}
          height={height}
          fill={bgColor}
          stroke="none"
        />,
        <text
          key={`${index}-text`}
          x={textX}
          y={top + height - 1}
          fontSize={height}
          fill={isNonTriplet ? 'red' : 'black'}
          textAnchor="middle"
        >
          {label}
        </text>,
      )
    }
  }

  if (dontRenderRect) {
    return null
  }

  return (
    <>
      {topLevel ? <Arrow {...props} /> : null}
      <rect
        data-testid={`box-${feature.id()}`}
        x={leftWithinBlock}
        y={top}
        width={widthWithinBlock}
        height={height}
        fill={fill}
        stroke={readConfObject(config, 'outline', { feature }) as string}
      />
      {elements}
    </>
  )
})

export default CDS
