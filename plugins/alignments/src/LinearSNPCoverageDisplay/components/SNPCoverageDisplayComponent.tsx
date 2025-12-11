import { LinearWiggleDisplayReactComponent } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import SashimiArcs from './SashimiArcs'

import type { SNPCoverageDisplayModel } from '../model'

const SNPCoverageDisplayComponent = observer(function (props: {
  model: SNPCoverageDisplayModel
}) {
  const { model } = props

  return (
    <div style={{ position: 'relative' }}>
      <SashimiArcs model={model} />
      <LinearWiggleDisplayReactComponent {...props} />
    </div>
  )
})

export default SNPCoverageDisplayComponent
