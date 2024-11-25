import React from 'react'
import { observer } from 'mobx-react'

// local
import Arcs from './Arcs'
import BaseDisplayComponent from './BaseDisplayComponent'
import type { LinearArcDisplayModel } from '../model'

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
