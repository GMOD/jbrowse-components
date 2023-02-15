import React from 'react'
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
      fill={theme.palette.background.default}
    />
  )
}
