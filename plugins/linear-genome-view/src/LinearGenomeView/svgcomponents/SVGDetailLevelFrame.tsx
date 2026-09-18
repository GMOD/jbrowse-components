import { useTheme } from '@mui/material'

import { DETAIL_FRAME_WIDTH, detailLevelColor } from '../detailLevels.ts'

export default function SVGDetailLevelFrame({
  x,
  width,
  height,
}: {
  x: number
  width: number
  height: number
}) {
  const theme = useTheme()
  const inset = DETAIL_FRAME_WIDTH / 2
  return (
    <rect
      x={x + inset}
      y={inset}
      width={width - DETAIL_FRAME_WIDTH}
      height={height - DETAIL_FRAME_WIDTH}
      fill="none"
      stroke={detailLevelColor(theme)}
      strokeWidth={DETAIL_FRAME_WIDTH}
    />
  )
}
