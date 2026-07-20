import { observer } from 'mobx-react'

import BaseDisplayComponent from '../../shared/BaseDisplayComponent.tsx'
import Arcs from './Arcs.tsx'

import type { LinearArcDisplayModel } from '../model.ts'

const LinearArcReactComponent = observer(function LinearArcReactComponent({
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
