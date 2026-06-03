import { observer } from 'mobx-react'

import Arcs from './Arcs.tsx'
import BaseDisplayComponent from '../../shared/BaseDisplayComponent.tsx'

import type { LinearPairedArcDisplayModel } from '../model.ts'

const LinearArcReactComponent = observer(function LinearArcReactComponent({
  model,
  exportSVG,
}: {
  model: LinearPairedArcDisplayModel
  exportSVG?: boolean
}) {
  return (
    <BaseDisplayComponent model={model}>
      <Arcs model={model} exportSVG={exportSVG} />
    </BaseDisplayComponent>
  )
})

export default LinearArcReactComponent
