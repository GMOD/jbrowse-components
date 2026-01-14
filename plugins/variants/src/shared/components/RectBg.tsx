import { getFillProps } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'

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
      {...getFillProps(color || alpha(theme.palette.background.paper, 0.8))}
    />
  )
}

export default RectBg
