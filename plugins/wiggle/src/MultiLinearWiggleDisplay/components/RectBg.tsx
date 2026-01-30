import { getFillProps } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'

import { SIDEBAR_BACKGROUND_OPACITY } from './constants.ts'

const RectBg = ({
  x,
  y,
  width,
  height,
  color,
}: {
  x: number
  y: number
  width: number
  height: number
  color?: string
}) => {
  const theme = useTheme()
  return (
    <rect
      pointerEvents="auto"
      x={x}
      y={y}
      width={width}
      height={height}
      {...getFillProps(
        color || alpha(theme.palette.background.paper, SIDEBAR_BACKGROUND_OPACITY),
      )}
    />
  )
}

export default RectBg
