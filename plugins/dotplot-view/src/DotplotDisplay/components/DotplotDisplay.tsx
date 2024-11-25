import React from 'react'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// locals
import type { DotplotViewModel } from '../../DotplotView/model'
import type { DotplotDisplayModel } from '../stateModelFactory'

const DotplotDisplay = observer(function DotplotDisplay(props: {
  model: DotplotDisplayModel
  children?: React.ReactNode
}) {
  const { model, children } = props
  const { offsetX = 0, offsetY = 0 } = model.data || {}
  const view = getContainingView(model) as DotplotViewModel

  const top = view.vview.offsetPx - offsetY
  const left = -(view.hview.offsetPx - offsetX)
  return (
    <div style={{ position: 'relative' }}>
      <model.ReactComponent2
        {...props}
        style={{
          position: 'absolute',
          top,
          left,
        }}
      />
      {children}
    </div>
  )
})

export default DotplotDisplay
