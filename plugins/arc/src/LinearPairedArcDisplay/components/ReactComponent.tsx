import React from 'react'
import { observer } from 'mobx-react'

// local
import { LinearArcDisplayModel } from '../model'
import BaseDisplayComponent from './BaseDisplayComponent'
import Arcs from './Arcs'

const LinearArcReactComponent = observer(function ({
  model,
  exportSVG,
}: {
  model: LinearArcDisplayModel
  exportSVG?: boolean
}) {
  return (
    <BaseDisplayComponent model={model}>
      <Arcs model={model} exportSVG={exportSVG} />
    </BaseDisplayComponent>
  )
})

export default LinearArcReactComponent
