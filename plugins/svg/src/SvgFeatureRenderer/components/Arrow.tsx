import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { getStrokeColor } from './util'

import type { FeatureLayout, RenderConfigContext } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const Arrow = observer(function Arrow({
  feature,
  featureLayout,
  config,
  region,
}: {
  region: Region
  feature: Feature
  featureLayout: FeatureLayout
  config: AnyConfigurationModel
  configContext: RenderConfigContext
}) {
  const theme = useTheme()
  const strand = feature.get('strand')
  const reverseFlip = region.reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const { x: left, y: top, width, height } = featureLayout
  const color2 = getStrokeColor({ feature, config, theme })

  const size = 5
  const p =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null
  const y = top + height / 2

  if (!p) {
    return null
  }

  return (
    <>
      <line x1={p} x2={p + offset} y1={y} y2={y} stroke={color2} />
      <polygon
        points={`${p + offset / 2},${y - size / 2} ${p + offset / 2},${y + size / 2} ${p + offset},${y}`}
        stroke={color2}
        fill={color2}
      />
    </>
  )
})

export default Arrow
