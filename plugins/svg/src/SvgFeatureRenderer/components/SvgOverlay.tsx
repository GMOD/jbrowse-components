import { bpSpanPx } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import React from 'react'

type LayoutRecord = [number, number, number, number]

interface OverlayRectProps extends React.SVGProps<SVGRectElement> {
  rect?: LayoutRecord
  region: Region
  bpPerPx: number
}

export function OverlayRect({
  rect,
  region,
  bpPerPx,
  ...rectProps
}: OverlayRectProps) {
  if (!rect) {
    return null
  }
  const [leftBp, topPx, rightBp, bottomPx] = rect
  const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
  const rectTop = Math.round(topPx)
  const screenWidth = (region.end - region.start) / bpPerPx
  const rectHeight = Math.round(bottomPx - topPx)
  const width = rightPx - leftPx

  if (leftPx + width < 0) {
    return null
  }
  const leftWithinBlock = Math.max(leftPx, 0)
  const diff = leftWithinBlock - leftPx
  const widthWithinBlock = Math.max(1, Math.min(width - diff, screenWidth))

  return (
    <rect
      x={leftWithinBlock - 2}
      y={rectTop - 2}
      width={widthWithinBlock + 4}
      height={rectHeight + 4}
      {...rectProps}
    />
  )
}
