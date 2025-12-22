import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { WiggleDisplayModel } from '../model'

const YScaleBarsWrapper = observer(function YScaleBarsWrapper({
  children,
  model,
  exportSVG,
}: {
  model: WiggleDisplayModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  const { height } = model
  return exportSVG ? (
    children
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        height,
        width: getContainingView(model).width,
      }}
    >
      {children}
    </svg>
  )
})

export default YScaleBarsWrapper
