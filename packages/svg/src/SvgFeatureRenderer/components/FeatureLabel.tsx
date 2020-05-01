import React from 'react'

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
    featureWidth,
    reversed = false,
    allowedWidthExpansion,
    fontWidthScaleFactor = 0.6,
  } = props

  const fontWidth = fontHeight * fontWidthScaleFactor
  const totalWidth =
    featureWidth && allowedWidthExpansion
      ? featureWidth + allowedWidthExpansion
      : Infinity

  return (
    <text
      x={reversed ? x + (featureWidth || 0) - fontWidth * text.length : x}
      y={y}
      style={{ fontSize: fontHeight, fill: color, cursor: 'default' }}
      dominantBaseline="hanging"
    >
      {fontWidth * text.length > totalWidth
        ? `${text.slice(0, totalWidth / fontWidth)}...`
        : text}
    </text>
  )
}
