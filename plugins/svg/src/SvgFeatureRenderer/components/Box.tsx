import { readConfObject } from '@jbrowse/core/configuration'
import { getFillProps, getStrokeProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Arrow from './Arrow'
import { getBoxColor } from './util'
import { isUTR } from './isUTR'

import type { FeatureLayout, RenderConfigContext } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const utrHeightFraction = 0.65

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
  const { colorByCDS, feature, region, config, featureLayout, bpPerPx, topLevel } = props
  const { start, end } = region
  const screenWidth = Math.ceil((end - start) / bpPerPx)
  const featureType = feature.get('type') as string | undefined

  let { x: left, y: top, width, height } = featureLayout

  if (left + width < 0 || (feature.parent() && featureType === 'intron')) {
    return null
  }

  if (isUTR(feature)) {
    top += ((1 - utrHeightFraction) / 2) * height
    height *= utrHeightFraction
  }

  const leftWithinBlock = Math.max(left, 0)
  const widthWithinBlock = Math.max(2, Math.min(width - (leftWithinBlock - left), screenWidth))

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
