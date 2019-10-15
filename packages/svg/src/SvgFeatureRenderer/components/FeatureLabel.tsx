import React from 'react'

export default function Label(props: {
  text: string
  x: number
  y: number
  color?: string
  fontHeight?: number
  featureWidth?: number
  allowedWidthExpansion?: number
  fontWidthScaleFactor?: number
}): JSX.Element {
  const {
    text,
    x,
    y,
    color = 'black',
    fontHeight = 13,
    featureWidth,
    allowedWidthExpansion,
    fontWidthScaleFactor = 0.55,
  } = props
  const fontWidth = fontHeight * fontWidthScaleFactor
  const totalWidth =
    featureWidth && allowedWidthExpansion
      ? featureWidth + allowedWidthExpansion
      : Infinity

  return (
    <text
      x={x}
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
