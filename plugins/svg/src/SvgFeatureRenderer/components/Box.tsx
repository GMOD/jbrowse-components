import { readConfObject } from '@jbrowse/core/configuration'
import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Arrow from './Arrow'
import { isUTR } from './isUTR'
import { getBoxColor } from './util'

import type { FeatureLayout, RenderConfigContext } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const utrHeightFraction = 0.65

function getUtrAdjustedDimensions(y: number, height: number, isUtr: boolean) {
  if (isUtr) {
    return {
      top: y + ((1 - utrHeightFraction) / 2) * height,
      height: height * utrHeightFraction,
    }
  }
  return { top: y, height }
}

const Box = observer(function Box(props: {
  feature: Feature
  featureLayout: FeatureLayout
  region: Region
  bpPerPx: number
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  colorByCDS: boolean
  topLevel?: boolean
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
  const screenWidth = Math.ceil((end - start) / bpPerPx)
  const featureType = feature.get('type') as string | undefined

  const { x: left, y, width, height: layoutHeight } = featureLayout

  if (left + width < 0 || (feature.parent() && featureType === 'intron')) {
    return null
  }

  const { top, height } = getUtrAdjustedDimensions(
    y,
    layoutHeight,
    isUTR(feature),
  )
  const leftWithinBlock = Math.max(left, 0)
  const widthWithinBlock = Math.max(
    2,
    Math.min(width - (leftWithinBlock - left), screenWidth),
  )

  return (
    <>
      {topLevel ? <Arrow {...props} /> : null}
      <rect
        data-testid={`box-${feature.id()}`}
        x={leftWithinBlock}
        y={top}
        width={widthWithinBlock}
        height={height}
        {...getFillProps(getBoxColor({ feature, config, colorByCDS, theme }))}
        {...getStrokeProps(readConfObject(config, 'outline', { feature }))}
      />
    </>
  )
})

export default Box
