import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { LegendBarModel } from './types.ts'

const MultiVariantLegendBarWrapper = observer(
  function MultiVariantLegendBarWrapper({
    children,
    model,
    exportSVG,
  }: {
    model: LegendBarModel
    children: React.ReactNode
    exportSVG?: boolean
  }) {
    const { id, scrollTop, height, hierarchy, treeAreaWidth, showTree } = model
    const clipid = `legend-${typeof jest === 'undefined' ? id : 'test'}`
    const leftOffset = hierarchy && showTree ? treeAreaWidth : 0
    return exportSVG ? (
      <>
        <defs>
          <clipPath id={clipid}>
            <rect x={0} y={0} width={1000} height={height} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipid})`}>
          <g transform={`translate(0,${-scrollTop})`}>{children}</g>
        </g>
      </>
    ) : (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: leftOffset,
          zIndex: 100,
          pointerEvents: 'none',
          height: model.totalHeight,
          width: getContainingView(model).width,
        }}
      >
        {children}
      </svg>
    )
  },
)

export default MultiVariantLegendBarWrapper
