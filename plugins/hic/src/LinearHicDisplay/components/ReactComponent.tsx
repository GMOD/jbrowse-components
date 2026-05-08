import { useRef, useState } from 'react'

import { CanvasDisplayWrapper, ErrorOverlay } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import {
  getContainingView,
  reducePrecision,
  useGpuModelLifecycle,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import HicOverlayPanel from './HicOverlayPanel.tsx'
import { HicRenderer } from './HicRenderer.ts'

import type { HicContactItem } from '../../RenderHicDataRPC/types.ts'
import type { LinearHicDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const SQRT2 = Math.SQRT2

function HicTooltip({
  item,
  x,
  y,
}: {
  item: HicContactItem
  x: number
  y: number
}) {
  return (
    <BaseTooltip clientPoint={{ x: x + 15, y }}>
      <div>Score: {reducePrecision(item.counts)}</div>
    </BaseTooltip>
  )
}

function Crosshairs({
  x,
  y,
  yScalar,
  width,
  height,
}: {
  x: number
  y: number
  yScalar: number
  width: number
  height: number
}) {
  const dx = y / yScalar
  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      <g stroke="#000" strokeWidth="1" fill="none">
        <path d={`M ${x - dx} 0 L ${x} ${y} L ${x + dx} 0`} />
      </g>
    </svg>
  )
}

function screenToUnrotated(
  screenX: number,
  screenY: number,
  yScalar: number,
) {
  const scaledY = screenY / yScalar
  const x = (screenX - scaledY) / SQRT2
  const y = (screenX + scaledY) / SQRT2
  return { x, y }
}

// Walk the cumulative pixel-start array (length regions+1) to find which
// region a coord falls into. Linear scan — region count is small (typically
// 1-5).
function findRegionIdx(coord: number, pixelStarts: number[]) {
  for (let i = pixelStarts.length - 2; i >= 0; i--) {
    if (coord >= pixelStarts[i]!) {
      return i
    }
  }
  return 0
}

const HicCanvas = observer(function HicCanvas({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const width = view.totalWidthPx
  const {
    height,
    rpcData,
    items,
    hoverLookup,
    regionPixelStarts,
    regionCombinedOffsets,
    binWidth,
    yScalar,
  } = model

  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredItem, setHoveredItem] = useState<HicContactItem>()
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
  }>()
  const [localMousePos, setLocalMousePos] = useState<{
    x: number
    y: number
  }>()

  const { canvasRef, error, retry } = useGpuModelLifecycle(HicRenderer, model)

  // Hover hit-test inverts the same transform the renderer used, so it
  // reads the model's renderTransform getter (single source of truth shared
  // with renderState).
  const { scale: viewScale, viewOffsetX } = model.renderTransform

  const onMouseMove = (event: React.MouseEvent) => {
    if (
      !containerRef.current ||
      !hoverLookup ||
      !regionPixelStarts ||
      !regionCombinedOffsets ||
      binWidth === undefined ||
      !items.length
    ) {
      setHoveredItem(undefined)
      setMousePosition(undefined)
      return
    }

    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    setMousePosition({ x: event.clientX, y: event.clientY })
    setLocalMousePos({ x: mouseX, y: mouseY })

    const dataScreenX = (mouseX - viewOffsetX) / viewScale
    const dataScreenY = mouseY / viewScale
    const { x, y } = screenToUnrotated(dataScreenX, dataScreenY, yScalar)

    // x,y are in unrotated pixel coords. Each contact rect is at
    //   ((bin1 + regionCombinedOffsets[r1]) * binWidth,
    //    (bin2 + regionCombinedOffsets[r2]) * binWidth)
    // and is binWidth × binWidth in size. Find the region pair from
    // regionPixelStarts, then invert the position formula.
    const r1 = findRegionIdx(x, regionPixelStarts)
    const r2 = findRegionIdx(y, regionPixelStarts)
    const bin1 = Math.floor(x / binWidth - regionCombinedOffsets[r1]!)
    const bin2 = Math.floor(y / binWidth - regionCombinedOffsets[r2]!)
    const idx = hoverLookup[`${r1}|${r2}|${bin1}|${bin2}`]
    setHoveredItem(idx !== undefined ? items[idx] : undefined)
  }

  const onMouseLeave = () => {
    setHoveredItem(undefined)
    setMousePosition(undefined)
    setLocalMousePos(undefined)
  }

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width}
        height={height}
        onRetry={() => {
          retry()
        }}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        cursor: hoveredItem && mousePosition ? 'crosshair' : undefined,
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <canvas
        data-testid={`hic_canvas${rpcData ? '_done' : ''}`}
        ref={canvasRef}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
        }}
      />
      <HicOverlayPanel model={model} />
      {hoveredItem && localMousePos ? (
        <Crosshairs
          x={localMousePos.x}
          y={localMousePos.y}
          yScalar={yScalar}
          width={width}
          height={height}
        />
      ) : null}
      {hoveredItem && mousePosition ? (
        <HicTooltip
          item={hoveredItem}
          x={mousePosition.x}
          y={mousePosition.y}
        />
      ) : null}
    </div>
  )
})

const LinearHicReactComponent = observer(function LinearHicReactComponent({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  return (
    <CanvasDisplayWrapper model={model}>
      <HicCanvas model={model} />
    </CanvasDisplayWrapper>
  )
})

export default LinearHicReactComponent
