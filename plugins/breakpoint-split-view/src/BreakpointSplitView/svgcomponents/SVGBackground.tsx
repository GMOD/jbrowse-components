import React from 'react'
import { useTheme } from '@mui/material'
import { stripAlpha } from '@jbrowse/core/util'

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
      fill={stripAlpha(theme.palette.background.default)}
    />
  )
}
