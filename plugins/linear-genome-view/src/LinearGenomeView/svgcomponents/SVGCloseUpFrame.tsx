import { usePalette } from '@jbrowse/core/ui/PaletteContext'

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
  const palette = usePalette()
  const inset = CLOSE_UP_FRAME_WIDTH / 2
  return (
    <rect
      x={x + inset}
      y={inset}
      width={width - CLOSE_UP_FRAME_WIDTH}
      height={height - CLOSE_UP_FRAME_WIDTH}
      fill="none"
      stroke={closeUpColor(palette)}
      strokeWidth={CLOSE_UP_FRAME_WIDTH}
    />
  )
}
