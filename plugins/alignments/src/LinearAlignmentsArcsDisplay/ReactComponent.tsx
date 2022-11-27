import React from 'react'
import { observer } from 'mobx-react'
import { LinearAlignmentsArcsDisplayModel } from './model'

const height = 1200

function LinearAlignmentsArcDisplay({
  model,
}: {
  model: LinearAlignmentsArcsDisplayModel
}) {
  return (
    <canvas
      ref={ref => model.setRef(ref)}
      style={{ width: '100%', height }}
      height={height * 2}
    />
  )
}

export default observer(LinearAlignmentsArcDisplay)
