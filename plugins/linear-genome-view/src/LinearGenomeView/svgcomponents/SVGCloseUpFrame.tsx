import { useTheme } from '@mui/material'

import { CLOSE_UP_FRAME_WIDTH, closeUpColor } from '../closeUps.ts'

export default function SVGCloseUpFrame({
  x,
  width,
  height,
}: {
  x: number
  width: number
  height: number
}) {
  const theme = useTheme()
  const inset = CLOSE_UP_FRAME_WIDTH / 2
  return (
    <rect
      x={x + inset}
      y={inset}
      width={width - CLOSE_UP_FRAME_WIDTH}
      height={height - CLOSE_UP_FRAME_WIDTH}
      fill="none"
      stroke={closeUpColor(theme)}
      strokeWidth={CLOSE_UP_FRAME_WIDTH}
    />
  )
}
