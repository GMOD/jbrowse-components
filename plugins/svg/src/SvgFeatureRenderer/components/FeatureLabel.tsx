import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { isAlive, isStateTreeNode } from 'mobx-state-tree'
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
    exportSVG,
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
    displayModel?: DisplayModel
    exportSVG?: unknown
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
    const params =
      isStateTreeNode(displayModel) && isAlive(displayModel)
        ? getViewParams(displayModel)
        : viewParams

    const viewLeft = reversed ? params.end : params.start

    const [labelVisible, setLabelVisible] = useState(exportSVG)

    // we use an effect to set the label visible because there can be a
    // mismatch between the server and the client after hydration due to the
    // floating labels. if we are exporting an SVG we allow it as is though and
    // do not use the effetct
    useEffect(() => {
      setLabelVisible(true)
    }, [])

    if (isStateTreeNode(region) && !isAlive(region)) {
      return null
    }

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
    if (
      viewLeft < rend &&
      viewLeft > rstart &&
      fstart < viewLeft &&
      viewLeft + featureWidthBp < fend
    ) {
      x = params.offsetPx
    } else if (
      fstart < viewLeft &&
      viewLeft + featureWidthBp < fend &&
      viewLeft + featureWidthBp > rstart &&
      viewLeft + featureWidthBp < rend
    ) {
      x = params.offsetPx1
    }

    return labelVisible ? (
      <text x={x} y={y + fontHeight} fill={color} fontSize={fontHeight}>
        {measuredTextWidth > totalWidth
          ? `${text.slice(0, totalWidth / (fontHeight * 0.6))}...`
          : text}
      </text>
    ) : null
  },
)
