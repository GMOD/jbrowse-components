import React from 'react'

import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend.tsx'
import SvgWrapper from './SvgWrapper.tsx'

import type { LinearMafDisplayModel } from '../../stateModel.ts'

const YScaleBars = observer(function (props: {
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
