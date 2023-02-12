import React from 'react'
import { useTheme } from '@mui/material'

export default function SVGBackground({
  width,
  height,
  shift,
}: {
  width: number
  height: number
  shift: number
}) {
  const theme = useTheme()
  return (
    <rect
      width={width + shift * 2}
      height={height}
      fill={theme.palette.background.default}
    />
  )
}
