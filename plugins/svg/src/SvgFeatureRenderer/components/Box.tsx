import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Region } from '@jbrowse/core/util/types'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { observer } from 'mobx-react'
import { isUTR } from './util'
import Arrow from './Arrow'

const utrHeightFraction = 0.65

function Box(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: any
  bpPerPx: number
  selected?: boolean
  topLevel?: boolean
  children?: React.ReactNode
}) {
  const { feature, region, config, featureLayout, bpPerPx, topLevel } = props
  const { start, end } = region
  const screenWidth = (end - start) / bpPerPx
  const color2 = readConfObject(config, 'color2', { feature }) as string

  const color = isUTR(feature)
    ? readConfObject(config, 'color3', { feature })
    : readConfObject(config, 'color1', { feature })

  const { left, width } = featureLayout.absolute
  let { top, height } = featureLayout.absolute

  if (left + width < 0) {
    return null
  }

  if (isUTR(feature)) {
    top += ((1 - utrHeightFraction) / 2) * height
    height *= utrHeightFraction
  }
  const leftWithinBlock = Math.max(left, 0)
  const diff = leftWithinBlock - left
  const widthWithinBlock = Math.max(1, Math.min(width - diff, screenWidth))

  return (
    <>
      <rect
        data-testid={`box-${feature.id()}`}
        x={leftWithinBlock}
        y={top}
        width={widthWithinBlock}
        height={height}
        fill={color}
        stroke={color2}
      />
      {topLevel ? <Arrow {...props} /> : null}
    </>
  )
}

export default observer(Box)
