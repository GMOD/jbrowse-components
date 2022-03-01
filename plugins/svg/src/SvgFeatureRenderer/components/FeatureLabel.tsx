import React from 'react'
import { observer } from 'mobx-react'
import { measureText } from '@jbrowse/core/util'
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

    return (
      <text x={x} y={y + fontHeight} fill={color} fontSize={fontHeight}>
        {measuredTextWidth > totalWidth
          ? `${text.slice(0, measuredTextWidth)}...`
          : text}
      </text>
    )
  },
)
