import React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { getFrame } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import Arrow from './Arrow'
import { isUTR } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region, Feature } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const utrHeightFraction = 0.65

const Box = observer(function Box(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: SceneGraph
  bpPerPx: number
  selected?: boolean
  topLevel?: boolean
  colorByCDS: boolean
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
  } = props
  const { start, end } = region
  const screenWidth = (end - start) / bpPerPx
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const featureType: string | undefined = feature.get('type')
  const featureStrand: -1 | 1 | undefined = feature.get('strand')
  const featurePhase: 0 | 1 | 2 | undefined = feature.get('phase')
  const width = (featureEnd - featureStart) / bpPerPx
  const { left = 0 } = featureLayout.absolute
  let { top = 0, height = 0 } = featureLayout.absolute

  if (left + width < 0) {
    return null
  }

  if (isUTR(feature)) {
    top += ((1 - utrHeightFraction) / 2) * height
    height *= utrHeightFraction
  }
  const leftWithinBlock = Math.max(left, 0)
  const diff = leftWithinBlock - left
  const widthWithinBlock = Math.max(2, Math.min(width - diff, screenWidth))

  let fill: string = isUTR(feature)
    ? readConfObject(config, 'color3', { feature })
    : readConfObject(config, 'color1', { feature })
  if (
    colorByCDS &&
    featureType === 'CDS' &&
    featureStrand !== undefined &&
    featurePhase !== undefined
  ) {
    const frame = getFrame(
      featureStart,
      featureEnd,
      featureStrand,
      featurePhase,
    )
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    if (frameColor) {
      fill = frameColor
    }
  }

  // if feature has parent and type is intron, then don't render the intron
  // subfeature (if it doesn't have a parent, then maybe the introns are
  // separately displayed features that should be displayed)
  return feature.parent() && featureType === 'intron' ? null : (
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
    </>
  )
})

export default Box
