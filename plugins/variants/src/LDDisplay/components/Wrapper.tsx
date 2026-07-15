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
  const { width } = getContainingView(model) as LinearGenomeViewModel
  // No horizontal shift: both live (svg at container-x 0) and export place the
  // overlay in the same x=0 frame as the LD matrix canvas. When offsetPx < 0 the
  // gap is carried by renderTransform.viewOffsetX (which the matrix render and
  // the connector/label genomic-x share), not by translating this group.
  return exportSVG ? (
    <g transform={`translate(0 ${yOffset})`}>{children}</g>
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        height,
        width,
      }}
    >
      {children}
    </svg>
  )
})

export default Wrapper
