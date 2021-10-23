import React from 'react'
import { measureText } from '@jbrowse/core/util'

export default function Label(props: {
  text: string
  x: number
  y: number
  color?: string
  fontHeight?: number
  featureWidth?: number
  allowedWidthExpansion?: number
  reversed?: boolean
  fontWidthScaleFactor?: number
}) {
  const {
    text,
    x,
    y,
    color = 'black',
    fontHeight = 13,
    featureWidth = 0,
    reversed,
    allowedWidthExpansion,
    fontWidthScaleFactor = 0.6,
  } = props

  const fontWidth = fontHeight * fontWidthScaleFactor
  const totalWidth =
    featureWidth && allowedWidthExpansion
      ? featureWidth + allowedWidthExpansion
      : Infinity

  const measuredTextWidth = measureText(text, fontHeight)

  return (
    <text
      x={reversed ? x + featureWidth - measuredTextWidth : x}
      y={y + fontHeight}
      style={{ fontSize: fontHeight, fill: color, cursor: 'default' }}
    >
      {measuredTextWidth > totalWidth
        ? `${text.slice(0, totalWidth / fontWidth)}...`
        : text}
    </text>
  )
}
