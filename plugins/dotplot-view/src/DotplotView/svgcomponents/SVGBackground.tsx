import React from 'react'
import Color from 'color'
import { useTheme } from '@mui/material'

export default function SVGBackground({
  width,
  height,
}: {
  width: number
  height: number
}) {
  const theme = useTheme()
  return (
    <rect
      x={0}
      y={0}
      width={width}
      height={height}
      fill={Color(theme.palette.background.default).hex()}
    />
  )
}
