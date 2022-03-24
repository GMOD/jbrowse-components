import React from 'react'
import { observer } from 'mobx-react'
import { isStateTreeNode } from 'mobx-state-tree'
import { measureText, getViewParams } from '@jbrowse/core/util'
import { DisplayModel } from './util'

export default observer(
  ({
    text,
    x,
    y,
    reversed,
    color = 'black',
    fontHeight = 13,
    featureWidth = 0,
    allowedWidthExpansion = 0,
    feature,
    viewStart,
    viewEnd,
    viewOffsetPx,
    displayModel = {},
  }: {
    text: string
    x: number
    y: number
    color?: string
    fontHeight?: number
    featureWidth?: number
    allowedWidthExpansion?: number
    reversed?: boolean
    displayModel: DisplayModel
  }) => {
    const totalWidth = featureWidth + allowedWidthExpansion
    const measuredTextWidth = measureText(text, fontHeight)

    if (isStateTreeNode(displayModel)) {
      const params = getViewParams(displayModel)
      viewStart = params.viewStart
      viewEnd = params.viewEnd
      viewOffsetPx = params.viewOffsetPx
    }
    const viewLeft = reversed ? viewEnd : viewStart

    const fstart = feature.get('start')
    const fend = feature.get('end')
    // const [fstart, fend] = reversed ? [end, start] : [start, end]
    const w = featureWidth
    if (reversed) {
      if (fstart < viewLeft + w && viewLeft - w < fend) {
        x = viewOffsetPx
      }
    } else {
      if (fstart < viewLeft + w && viewLeft - w < fend) {
        x = viewOffsetPx
      }
    }

    return (
      <text x={x} y={y + fontHeight} fill={color} fontSize={fontHeight}>
        {measuredTextWidth > totalWidth
          ? `${text.slice(0, measuredTextWidth)}...`
          : text}
      </text>
    )
  },
)
