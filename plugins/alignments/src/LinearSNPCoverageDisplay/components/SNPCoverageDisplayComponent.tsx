import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import SashimiArcs from './SashimiArcs'

import type { SNPCoverageDisplayModel } from '../model'

const SNPCoverageDisplayComponent = observer(
  function SNPCoverageDisplayComponent(props: {
    model: SNPCoverageDisplayModel
  }) {
    const { model } = props

    return (
      <div style={{ position: 'relative' }}>
        <LinearWiggleDisplayReactComponent {...props} />
        <SashimiArcs model={model} />
      </div>
    )
  },
)

export default SNPCoverageDisplayComponent
