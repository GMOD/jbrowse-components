import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { emphasize } from '@jbrowse/core/util/color'
import { Region } from '@jbrowse/core/util/types'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { observer } from 'mobx-react'

function Box({
  feature,
  region,
  config,
  featureLayout,
  selected = false,
  bpPerPx,
}: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: any
  selected: any
  bpPerPx: number
  children?: React.ReactNode
}) {
  const screenWidth = (region.end - region.start) / bpPerPx
  const color1 = readConfObject(config, 'color1', { feature }) as string
  const color2 = readConfObject(config, 'color2', { feature }) as string
  let emphasizedColor1
  try {
    emphasizedColor1 = emphasize(color1, 0.3)
  } catch (error) {
    emphasizedColor1 = color1
  }
  const { left, top, width, height } = featureLayout.absolute

  if (left + width < 0) {
    return null
  }
  const leftWithinBlock = Math.max(left, 0)
  const diff = leftWithinBlock - left
  const widthWithinBlock = Math.max(1, Math.min(width - diff, screenWidth))

  return (
    <rect
      data-testid={`box-${feature.id()}`}
      x={leftWithinBlock}
      y={top}
      width={widthWithinBlock}
      height={height}
      fill={selected ? emphasizedColor1 : color1}
      stroke={selected ? color2 : undefined}
    />
  )
}

export default observer(Box)
