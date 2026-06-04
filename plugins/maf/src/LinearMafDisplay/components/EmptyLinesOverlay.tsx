import { observer } from 'mobx-react'

import OverlayCanvas from './OverlayCanvas.tsx'
import { drawMafEmptyLines } from '../../LinearMafRenderer/rendering/emptyLines.ts'

import type { EmptyLineSegment } from './computeVisibleEmptyLines.ts'
import type { MafColorPalette } from '../../LinearMafRenderer/util.ts'

const EmptyLinesOverlay = observer(function EmptyLinesOverlay({
  segments,
  width,
  height,
  palette,
}: {
  segments: EmptyLineSegment[]
  width: number
  height: number
  palette: MafColorPalette
}) {
  if (segments.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawMafEmptyLines(ctx, segments, palette)
      }}
    />
  )
})

export default EmptyLinesOverlay
