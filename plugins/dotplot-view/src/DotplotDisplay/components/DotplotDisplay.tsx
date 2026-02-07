import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import DotplotWebGLCanvas from './DotplotWebGLCanvas.tsx'

import type { DotplotViewModel } from '../../DotplotView/model.ts'
import type { DotplotDisplayModel } from '../stateModelFactory.tsx'

const DotplotDisplay = observer(function DotplotDisplay(props: {
  model: DotplotDisplayModel
  children?: React.ReactNode
}) {
  const { model, children } = props
  const view = getContainingView(model) as DotplotViewModel

  if (view.useWebGL) {
    return (
      <DotplotWebGLCanvas model={model}>
        {children}
      </DotplotWebGLCanvas>
    )
  }

  const { offsetX = 0, offsetY = 0 } = model.data || {}
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
