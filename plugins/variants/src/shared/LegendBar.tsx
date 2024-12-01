import React from 'react'

import { getContainingView, measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend'

import type { Source } from '../util'

interface ReducedModel {
  totalHeight: number
  rowHeight: number
  lineZoneHeight?: number
  sources?: Source[]
}

const Wrapper = observer(function ({
  children,
  model,
  exportSVG,
}: {
  model: ReducedModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  return exportSVG ? (
    children
  ) : (
    <svg
      id="colorlegend"
      style={{
        position: 'absolute',
        top: model.lineZoneHeight || 0,
        left: 0,
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
  model: ReducedModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { model, exportSVG } = props
  const { rowHeight, sources } = model
  const svgFontSize = Math.min(rowHeight, 12)
  const canDisplayLabel = rowHeight > 11
  return sources ? (
    <Wrapper {...props}>
      <ColorLegend
        exportSVG={exportSVG}
        model={model}
        labelWidth={Math.max(
          ...sources
            .map(s => measureText(s.name, svgFontSize))
            .map(width => (canDisplayLabel ? width : 20)),
        )}
      />
    </Wrapper>
  ) : null
})

export default LegendBar
