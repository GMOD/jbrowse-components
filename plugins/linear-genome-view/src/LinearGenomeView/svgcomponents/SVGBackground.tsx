import React from 'react'
import { stripAlpha } from '@jbrowse/core/util'
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
      fill={stripAlpha(theme.palette.background.default)}
    />
  )
}
