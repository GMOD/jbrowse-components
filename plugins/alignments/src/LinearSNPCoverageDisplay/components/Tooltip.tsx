import { Tooltip } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import TooltipContents from './TooltipContents'

import type { Feature } from '@jbrowse/core/util'

type Coord = [number, number]

const SNPCoverageTooltip = observer(function (props: {
  model: {
    featureUnderMouse?: Feature
  }
  height: number
  offsetMouseCoord: Coord
  clientMouseCoord: Coord
  clientRect?: DOMRect
}) {
  const { model } = props
  const { featureUnderMouse: feat } = model
  return feat && feat.get('type') === 'skip' ? null : (
    <Tooltip TooltipContents={TooltipContents} {...props} />
  )
})

export default SNPCoverageTooltip
