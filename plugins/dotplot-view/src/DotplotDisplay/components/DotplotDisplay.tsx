import { observer } from 'mobx-react'

import DotplotAxesCanvas from '../DotplotAxesCanvas.tsx'
import DotplotWebGLCanvas from './DotplotWebGLCanvas.tsx'

import type { DotplotDisplayModel } from '../stateModelFactory.tsx'

const DotplotDisplay = observer(function DotplotDisplay(props: {
  model: DotplotDisplayModel
  children?: React.ReactNode
}) {
  const { children } = props

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DotplotAxesCanvas {...props} />
      <DotplotWebGLCanvas {...props}>
        {children}
      </DotplotWebGLCanvas>
    </div>
  )
})

export default DotplotDisplay
