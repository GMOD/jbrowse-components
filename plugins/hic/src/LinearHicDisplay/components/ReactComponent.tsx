import { useMemo, useRef, useState } from 'react'

import { CanvasDisplayWrapper, ErrorOverlay } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import {
  getContainingView,
  reducePrecision,
  useGpuModelLifecycle,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import HicColorLegend from './HicColorLegend.tsx'
import { HicRenderer } from './HicRenderer.ts'

import type { HicFlatbushItem } from '../../RenderHicDataRPC/types.ts'
import type { LinearHicDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const SQRT2 = Math.SQRT2

function HicTooltip({
  item,
  x,
  y,
}: {
  item: HicFlatbushItem
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
): { x: number; y: number } {
  const scaledY = screenY / yScalar
  const x = (screenX - scaledY) / SQRT2
  const y = (screenX + scaledY) / SQRT2
  return { x, y }
}

const ResolutionControl = observer(function ResolutionControl({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const t0 = performance.now()
  const { resolution, availableResolutions } = model
  const canGoFiner = availableResolutions?.some(r => r < resolution) ?? false
  const canGoCoarser = availableResolutions?.some(r => r > resolution) ?? false
  console.warn('[HiC Perf] ResolutionControl render time:', (performance.now() - t0).toFixed(2), 'ms, resolution:', resolution)

  const handleFiner = () => {
    const t0 = performance.now()
    console.warn('[HiC Perf] Finer button clicked, current resolution:', resolution)
    try {
      model.zoomResolutionFiner()
      const t1 = performance.now()
      console.warn(`[HiC Perf] zoomResolutionFiner done (${(t1 - t0).toFixed(1)}ms), new resolution:`, model.resolution)
    } catch (e) {
      console.error('Error adjusting HiC resolution:', e)
    }
  }

  const handleCoarser = () => {
    const t0 = performance.now()
    console.warn('[HiC Perf] Coarser button clicked, current resolution:', resolution)
    try {
      model.zoomResolutionCoarser()
      const t1 = performance.now()
      console.warn(`[HiC Perf] zoomResolutionCoarser done (${(t1 - t0).toFixed(1)}ms), new resolution:`, model.resolution)
    } catch (e) {
      console.error('Error adjusting HiC resolution:', e)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        display: 'flex',
        gap: 2,
        alignItems: 'center',
        fontSize: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        padding: '2px 4px',
        borderRadius: 2,
      }}
    >
      <button
        onClick={handleFiner}
        disabled={!canGoFiner}
        title="Finer"
        type="button"
        style={{
          padding: '2px 4px',
          fontSize: 10,
          cursor: canGoFiner ? 'pointer' : 'default',
          opacity: canGoFiner ? 1 : 0.5,
          border: '1px solid #ccc',
          background: '#fff',
          borderRadius: 2,
        }}
      >
        +
      </button>
      <span style={{ minWidth: 30, textAlign: 'center', fontSize: 10 }}>
        {(resolution / 1000).toFixed(0)}k
      </span>
      <button
        onClick={handleCoarser}
        disabled={!canGoCoarser}
        title="Coarser"
        type="button"
        style={{
          padding: '2px 4px',
          fontSize: 10,
          cursor: canGoCoarser ? 'pointer' : 'default',
          opacity: canGoCoarser ? 1 : 0.5,
          border: '1px solid #ccc',
          background: '#fff',
          borderRadius: 2,
        }}
      >
        −
      </button>
    </div>
  )
})

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
    flatbush,
    flatbushItems,
    yScalar,
    showLegend,
    colorMaxScore,
    colorScheme,
    useLogScale,
  } = model

  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredItem, setHoveredItem] = useState<HicFlatbushItem>()
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
  }>()
  const [localMousePos, setLocalMousePos] = useState<{
    x: number
    y: number
  }>()

  // Model owns the upload/render autorun — see startGpuBackendLifecycle on
  // the LinearHicDisplay model. The rpcData and colorScheme uploads are
  // identity-diffed independently so a colorScheme change doesn't re-upload
  // the contact matrix.
  const { canvasRef, error, retry } = useGpuModelLifecycle(HicRenderer, model)

  // View transform for hit-test math — mirrors renderState on the model.
  const { scale: viewScale, translateX: viewOffsetX } =
    model.viewportTransform(view)

  const flatbushIndex = useMemo(
    () => (flatbush ? Flatbush.from(flatbush) : null),
    [flatbush],
  )

  const onMouseMove = (event: React.MouseEvent) => {
    if (!containerRef.current || !flatbushIndex || !flatbushItems.length) {
      setHoveredItem(undefined)
      setMousePosition(undefined)
      return
    }

    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    setMousePosition({ x: event.clientX, y: event.clientY })
    setLocalMousePos({ x: mouseX, y: mouseY })

    // Reverse the shader transform to get data-space screen coordinates
    const dataScreenX = (mouseX - viewOffsetX) / viewScale
    const dataScreenY = mouseY / viewScale

    const { x, y } = screenToUnrotated(dataScreenX, dataScreenY, yScalar)

    const results = flatbushIndex.search(x - 1, y - 1, x + 1, y + 1)

    if (results.length > 0) {
      const item = flatbushItems[results[0]!]
      setHoveredItem(item)
    } else {
      setHoveredItem(undefined)
    }
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
      <ResolutionControl model={model} />
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
      {showLegend && colorMaxScore > 0 ? (
        <HicColorLegend
          maxScore={colorMaxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
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
