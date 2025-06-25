import React from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../../stateModel'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SvgWrapper = observer(function ({
  children,
  model,
  exportSVG,
}: {
  model: LinearMafDisplayModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  if (exportSVG) {
    return <>{children}</>
  } else {
    const { totalHeight } = model
    const { width } = getContainingView(model) as LinearGenomeViewModel
    return (
      <svg
        style={{
          position: 'absolute',
          userSelect: 'none',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          height: totalHeight,
          width,
        }}
      >
        {children}
      </svg>
    )
  }
})

export default SvgWrapper
