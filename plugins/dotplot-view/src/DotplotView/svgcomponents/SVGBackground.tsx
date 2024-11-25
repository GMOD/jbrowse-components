import React from 'react'
import { stripAlpha } from '@jbrowse/core/util'
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
      fill={stripAlpha(theme.palette.background.default)}
    />
  )
}
