import React from 'react'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { DotplotDisplayModel } from '..'

const DotplotDisplay: React.FC<{
  model: DotplotDisplayModel
  children?: React.ReactNode
}> = props => {
  const { model, children } = props
  const { offsetX = 0, offsetY = 0 } = model.data || {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const view = getContainingView(model) as any
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
}

export default observer(DotplotDisplay)
