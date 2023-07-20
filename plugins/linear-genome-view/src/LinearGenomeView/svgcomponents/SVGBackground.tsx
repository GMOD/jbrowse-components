import React from 'react'
import { useTheme } from '@mui/material'
import Color from 'color'

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
      fill={Color(theme.palette.background.default).hex()}
    />
  )
}
