import { useMemo } from 'react'

import { getContainingView, measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ColorLegend from './MultiVariantColorLegend'

import type { Source } from '../types'

interface LegendBarModel {
  id: string
  scrollTop: number
  height: number
  hierarchy?: any
  treeAreaWidth: number
  totalHeight: number
  canDisplayLabels: boolean
  rowHeight: number
  sources?: Source[]
}

const Wrapper = observer(function ({
  children,
  model,
  exportSVG,
}: {
  model: LegendBarModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  const { id, scrollTop, height, hierarchy, treeAreaWidth } = model
  const clipid = `legend-${id}`
  const leftOffset = hierarchy ? treeAreaWidth : 0
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
})

export const LegendBar = observer(function (props: {
  model: LegendBarModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { model } = props
  const { canDisplayLabels, rowHeight, sources } = model
  const svgFontSize = Math.min(rowHeight, 12)

  const labelWidth = useMemo(() => {
    if (!sources) {
      return 0
    }
    let maxWidth = 0
    for (const s of sources) {
      const width = canDisplayLabels
        ? measureText(s.label, svgFontSize) + 10
        : 20
      if (width > maxWidth) {
        maxWidth = width
      }
    }
    return maxWidth
  }, [sources, svgFontSize, canDisplayLabels])

  return sources ? (
    <Wrapper {...props}>
      <ColorLegend model={model} labelWidth={labelWidth} />
    </Wrapper>
  ) : null
})

export default LegendBar
