import { observer } from 'mobx-react'

import Arcs from '../../shared/Arcs.tsx'
import BaseDisplayComponent from '../../shared/BaseDisplayComponent.tsx'

import type { LinearPairedArcDisplayModel } from '../model.ts'

const LinearPairedArcReactComponent = observer(
  function LinearPairedArcReactComponent({
    model,
  }: {
    model: LinearPairedArcDisplayModel
  }) {
    return (
      <BaseDisplayComponent model={model}>
        <Arcs model={model} />
      </BaseDisplayComponent>
    )
  },
)

export default LinearPairedArcReactComponent
