import React from 'react'

import { getContainingView, measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ColorLegend from './ColorLegend'

import type { Source } from '../util'

interface ReducedModel {
  totalHeight: number
  rowHeight: number
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
      style={{
        position: 'absolute',
        top: 20,
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

export const YScaleBars = observer(function (props: {
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

export default YScaleBars
