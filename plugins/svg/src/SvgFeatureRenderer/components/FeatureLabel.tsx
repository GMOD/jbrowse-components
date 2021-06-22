import React from 'react'

export default function Label(props: {
  text: string
  x: number
  y: number
  width: number
  labelJustify: string
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
    width,
    labelJustify,
    color = 'black',
    fontHeight = 13,
    featureWidth,
    reversed,
    allowedWidthExpansion,
    fontWidthScaleFactor = 0.6,
  } = props

  const fontWidth = fontHeight * fontWidthScaleFactor
  const totalWidth =
    featureWidth && allowedWidthExpansion
      ? featureWidth + allowedWidthExpansion
      : Infinity

  let deltaX = 0
  let anchor = 'start'
  if (reversed) {
    switch (labelJustify) {
      case 'center':
        deltaX = width / 2 
        anchor = 'middle'
        break
      case 'right':
      case 'start':
        deltaX = width
        anchor = 'end'
        break
    }
  } else {
    switch (labelJustify) {
      case 'center':
        deltaX = width / 2 
        anchor = 'middle'
        break
      case 'right':
      case 'end':
        deltaX = width
        anchor = 'end'
        break
    }
  }

  return (
    <text
      textAnchor={anchor}
      x={x + deltaX}
      y={y + fontHeight}
      style={{ fontSize: fontHeight, fill: color, cursor: 'default' }}
    >
      {fontWidth * text.length > totalWidth
        ? `${text.slice(0, totalWidth / fontWidth)}...`
        : text}
    </text>
  )
}
