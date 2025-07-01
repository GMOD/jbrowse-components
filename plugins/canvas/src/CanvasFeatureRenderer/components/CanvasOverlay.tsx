import { useEffect, useState } from 'react'

import { bpSpanPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { Feature, Region } from '@jbrowse/core/util'

type LayoutRecord = [number, number, number, number]

interface OverlayRectProps {
  rect?: LayoutRecord
  region: Region
  bpPerPx: number
  ctx: CanvasRenderingContext2D
  fill?: string
  fillOpacity?: number
  stroke?: string
}

function drawOverlayRect({
  rect,
  region,
  bpPerPx,
  ctx,
  fill,
  fillOpacity,
  stroke,
}: OverlayRectProps) {
  if (!rect) {
    return
  }
  const [leftBp, topPx, rightBp, bottomPx] = rect
  const [leftPx, rightPx] = bpSpanPx(leftBp, rightBp, region, bpPerPx)
  const rectTop = Math.round(topPx)
  const screenWidth = (region.end - region.start) / bpPerPx
  const rectHeight = Math.round(bottomPx - topPx)
  const width = rightPx - leftPx

  if (leftPx + width < 0) {
    return
  }
  const leftWithinBlock = Math.max(leftPx, 0)
  const diff = leftWithinBlock - leftPx
  const widthWithinBlock = Math.max(1, Math.min(width - diff, screenWidth))

  ctx.save()
  if (fill) {
    ctx.fillStyle = fill
    if (fillOpacity !== undefined) {
      ctx.globalAlpha = fillOpacity
    }
    ctx.fillRect(leftWithinBlock - 2, rectTop - 2, widthWithinBlock + 4, rectHeight + 4)
  }
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.strokeRect(leftWithinBlock - 2, rectTop - 2, widthWithinBlock + 4, rectHeight + 4)
  }
  ctx.restore()
}

type ME = React.MouseEvent<HTMLCanvasElement>
type MEFE = ME | React.FocusEvent<HTMLCanvasElement>

const CanvasOverlay = observer(function ({
  displayModel = {},
  blockKey,
  region,
  bpPerPx,
  movedDuringLastMouseDown,
  ctx,
  ...handlers
}: {
  region: Region
  displayModel?: {
    getFeatureByID?: (arg0: string, arg1: string) => LayoutRecord
    selectedFeatureId?: string
    featureIdUnderMouse?: string
    contextMenuFeature?: Feature
  }
  bpPerPx: number
  blockKey: string
  movedDuringLastMouseDown?: boolean
  ctx: CanvasRenderingContext2D
  onFeatureMouseDown?(event: ME, featureId: string): void
  onFeatureMouseEnter?(event: ME, featureId: string): void
  onFeatureMouseOut?(event: MEFE, featureId: string): void
  onFeatureMouseOver?(event: MEFE, featureId: string): void
  onFeatureMouseUp?(event: ME, featureId: string): void
  onFeatureMouseLeave?(event: ME, featureId: string): void
  onFeatureMouseMove?(event: ME, featureId: string): void
  // synthesized from mouseup and mousedown
  onFeatureClick?(event: ME, featureId: string): void
  onFeatureContextMenu?(event: ME, featureId: string): void
}) {
  const { selectedFeatureId, featureIdUnderMouse, contextMenuFeature } =
    displayModel

  const mouseoverFeatureId = featureIdUnderMouse || contextMenuFeature?.id()
  const [renderOverlay, setRenderOverlay] = useState(false)
  useEffect(() => {
    setRenderOverlay(true)
  }, [])

  // Event handlers remain largely the same, but they will be attached to the canvas element
  // in CanvasFeatureRendering.tsx, and this component will just draw the overlays.
  // The handlers here are for internal logic related to feature IDs.

  if (!renderOverlay) {
    return null
  }

  if (mouseoverFeatureId) {
    drawOverlayRect({
      rect: displayModel.getFeatureByID?.(blockKey, mouseoverFeatureId),
      region,
      bpPerPx,
      ctx,
      fill: "#000",
      fillOpacity: 0.2,
    })
  }
  if (selectedFeatureId) {
    drawOverlayRect({
      rect: displayModel.getFeatureByID?.(blockKey, selectedFeatureId),
      region,
      bpPerPx,
      ctx,
      stroke: "#00b8ff",
    })
  }

  return null // This component now only draws, it doesn't render JSX elements
})

export default CanvasOverlay