import React from 'react'
import { observer } from 'mobx-react'
import { isStateTreeNode } from 'mobx-state-tree'
import { measureText, getViewParams, Feature } from '@jbrowse/core/util'
import { DisplayModel } from './util'

export default observer(
  ({
    text,
    x,
    y,
    reversed,
    bpPerPx,
    feature,
    viewParams,
    color = 'black',
    fontHeight = 13,
    featureWidth = 0,
    allowedWidthExpansion = 0,
    displayModel = {},
  }: {
    text: string
    x: number
    y: number
    color?: string
    fontHeight?: number
    featureWidth?: number
    bpPerPx: number
    allowedWidthExpansion?: number
    feature: Feature
    reversed?: boolean
    displayModel: DisplayModel
    viewParams: { start: number; end: number; offsetPx: number }
  }) => {
    const totalWidth = featureWidth + allowedWidthExpansion
    const measuredTextWidth = measureText(text, fontHeight)
    const params = isStateTreeNode(displayModel)
      ? getViewParams(displayModel)
      : viewParams

    const viewLeft = reversed ? params.end : params.start

    const fstart = feature.get('start')
    const fend = feature.get('end')

    if (reversed) {
      if (fstart < viewLeft && viewLeft < fend) {
        x = params.offsetPx
      }
    } else {
      if (fstart < viewLeft && viewLeft + measuredTextWidth * bpPerPx < fend) {
        x = params.offsetPx
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
