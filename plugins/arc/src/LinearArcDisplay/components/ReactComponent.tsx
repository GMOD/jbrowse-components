import { observer } from 'mobx-react'

import Arcs from '../../shared/Arcs.tsx'
import BaseDisplayComponent from '../../shared/BaseDisplayComponent.tsx'

import type { LinearArcDisplayModel } from '../model.ts'

const LinearArcReactComponent = observer(function LinearArcReactComponent({
  model,
}: {
  model: LinearArcDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <Arcs model={model} />
    </BaseDisplayComponent>
  )
})

export default LinearArcReactComponent
