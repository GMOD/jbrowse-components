import React from 'react'

import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend'
import SvgWrapper from './SvgWrapper'

import type { LinearMafDisplayModel } from '../../stateModel'

export const YScaleBars = observer(function (props: {
  model: LinearMafDisplayModel
  exportSVG?: boolean
}) {
  const { model } = props
  return (
    <SvgWrapper {...props}>
      <ColorLegend model={model} />
    </SvgWrapper>
  )
})

export default YScaleBars
