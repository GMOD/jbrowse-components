import React from 'react'

import { getContainingView, measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// locals
import ColorLegend from './ColorLegend'

import type { VariantDisplayModel } from '../model'

const Wrapper = observer(function ({
  children,
  model,
  exportSVG,
}: {
  model: VariantDisplayModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  return exportSVG ? (
    children
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
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
  model: VariantDisplayModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { model, exportSVG } = props
  const { rowHeight, sources } = model
  const svgFontSize = Math.min(rowHeight, 12)
  const canDisplayLabel = rowHeight > 11
  const minWidth = 20

  const ready = sources
  if (!ready) {
    return null
  }

  const labelWidth = Math.max(
    ...sources
      .map(s => measureText(s.name, svgFontSize))
      .map(width => (canDisplayLabel ? width : minWidth)),
  )

  return (
    <Wrapper {...props}>
      <ColorLegend
        exportSVG={exportSVG}
        model={model}
        labelWidth={labelWidth}
      />
    </Wrapper>
  )
})

export default YScaleBars
