import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const Wrapper = observer(function Wrapper({
  children,
  model,
  exportSVG,
  yOffset = 0,
}: {
  model: SharedLDModel
  children: React.ReactNode
  exportSVG?: boolean
  yOffset?: number
}) {
  const { height } = model
  const { width, offsetPx } = getContainingView(model) as LinearGenomeViewModel
  const left = Math.max(0, -offsetPx)
  return exportSVG ? (
    <g transform={`translate(${left} ${yOffset})`}>{children}</g>
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left,
        height,
        width,
      }}
    >
      {children}
    </svg>
  )
})

export default Wrapper
