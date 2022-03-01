import React from 'react'
import { observer } from 'mobx-react'
import { measureText } from '@jbrowse/core/util'

export default observer(
  ({
    text,
    x,
    y,
    color = 'black',
    fontHeight = 13,
    featureWidth = 0,
    reversed,
    allowedWidthExpansion = 0,
  }: {
    text: string
    x: number
    y: number
    color?: string
    fontHeight?: number
    featureWidth?: number
    allowedWidthExpansion?: number
    reversed?: boolean
  }) => {
    const totalWidth = featureWidth + allowedWidthExpansion
    const measuredTextWidth = measureText(text, fontHeight)

    return (
      <text
        x={reversed ? x + featureWidth - measuredTextWidth : x}
        y={y + fontHeight}
        fill={color}
      >
        {measuredTextWidth > totalWidth
          ? `${text.slice(0, measuredTextWidth)}...`
          : text}
      </text>
    )
  },
)
