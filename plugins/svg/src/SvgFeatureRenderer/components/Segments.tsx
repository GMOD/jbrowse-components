import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Arrow from './Arrow'
import { getStrokeColor } from './util'

import type { FeatureLayout, RenderConfigContext } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const Segments = observer(function Segments(props: {
  region: Region
  feature: Feature
  featureLayout: FeatureLayout
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  colorByCDS: boolean
  bpPerPx: number
  topLevel?: boolean
}) {
  const { feature, featureLayout, config } = props
  const theme = useTheme()
  const color2 = getStrokeColor({ feature, config, theme })
  const { x: left, y: top, width, height } = featureLayout
  const y = top + height / 2

  return (
    <>
      <line
        data-testid={feature.id()}
        x1={left}
        y1={y}
        y2={y}
        x2={left + width}
        stroke={color2}
      />
      <Arrow {...props} />
    </>
  )
})

export default Segments
