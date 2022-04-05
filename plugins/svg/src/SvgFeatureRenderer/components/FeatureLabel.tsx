import React from 'react'
import { observer } from 'mobx-react'
import { isStateTreeNode } from 'mobx-state-tree'
import { measureText, getViewParams, Feature, Region } from '@jbrowse/core/util'
import { DisplayModel } from './util'

export default observer(
  ({
    text,
    x,
    y,
    region,
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
    region: Region
    viewParams: {
      start: number
      end: number
      offsetPx: number
      offsetPx1: number
    }
  }) => {
    const totalWidth = featureWidth + allowedWidthExpansion
    const measuredTextWidth = measureText(text, fontHeight)
    const params = isStateTreeNode(displayModel)
      ? getViewParams(displayModel)
      : viewParams

    const viewLeft = reversed ? params.end : params.start

    const rstart = region.start
    const rend = region.end
    const fstart = feature.get('start')
    const fend = feature.get('end')

    const featureWidthBp = measuredTextWidth * bpPerPx

    // this tricky bit of code helps smooth over block boundaries
    // not supported for reverse mode currently
    // reason: reverse mode allocates space for the label in the "normal
    // forward orientation" making it hard to slide. The reverse mode should
    // allocate the label space in the reverse orientation to slide it
    if (!reversed) {
      if (
        viewLeft < rend &&
        viewLeft > rstart &&
        fstart < viewLeft &&
        viewLeft + featureWidthBp < fend
      ) {
        x = params.offsetPx
      } else if (fstart < viewLeft && viewLeft + featureWidthBp < fend) {
        x = params.offsetPx1
      }
    }

    return (
      <text x={x} y={y + fontHeight} fill={color} fontSize={fontHeight}>
        {measuredTextWidth > totalWidth
          ? `${text.slice(0, totalWidth / (fontHeight * 0.6))}...`
          : text}
      </text>
    )
  },
)
