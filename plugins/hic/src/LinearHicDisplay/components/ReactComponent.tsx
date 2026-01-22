import { useCallback, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, reducePrecision } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import BaseDisplayComponent from './BaseDisplayComponent.tsx'
import HicColorLegend from '../../HicRenderer/components/HicColorLegend.tsx'

import type { HicFlatbushItem } from '../../HicRenderer/types.ts'
import type { LinearHicDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const SQRT2 = Math.sqrt(2)

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
  left,
  width,
  height,
}: {
  x: number
  y: number
  yScalar: number
  left: number
  width: number
  height: number
}) {
  const dx = y / yScalar
  return (
    <svg
      style={{
        position: 'absolute',
        left,
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

/**
 * Transform screen coordinates to the unrotated coordinate space.
 * The canvas is rotated by -45 degrees, so we apply the inverse rotation (+45 degrees).
 * Also accounts for the yScalar transformation.
 */
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

const HicCanvas = observer(function HicCanvas({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const {
    height,
    drawn,
    loading,
    flatbush,
    flatbushItems,
    yScalar,
    showLegend,
    maxScore,
    colorScheme,
    useLogScale,
    lastDrawnOffsetPx,
  } = model

  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredItem, setHoveredItem] = useState<HicFlatbushItem>()
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>()
  const [localMousePos, setLocalMousePos] = useState<{ x: number; y: number }>()

  // Convert flatbush data to Flatbush instance
  const flatbushIndex = useMemo(
    () => (flatbush ? Flatbush.from(flatbush) : null),
    [flatbush],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  const cb = useCallback(
    (ref: HTMLCanvasElement) => {
      model.setRef(ref)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, width, height],
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current || !flatbushIndex || !flatbushItems.length) {
        setHoveredItem(undefined)
        setMousePosition(undefined)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      // Account for canvas offset (same logic as canvas positioning)
      const mouseCanvasOffset =
        view.offsetPx >= 0
          ? (lastDrawnOffsetPx ?? 0) - view.offsetPx
          : Math.max(0, -view.offsetPx)
      const screenX = event.clientX - rect.left - mouseCanvasOffset
      const screenY = event.clientY - rect.top

      setMousePosition({ x: event.clientX, y: event.clientY })
      setLocalMousePos({ x: screenX, y: screenY })

      // Transform screen coordinates to unrotated space for Flatbush query
      const { x, y } = screenToUnrotated(screenX, screenY, yScalar)

      // Query Flatbush with a small region around the transformed point
      const results = flatbushIndex.search(x - 1, y - 1, x + 1, y + 1)

      if (results.length > 0) {
        const item = flatbushItems[results[0]!]
        setHoveredItem(item)
      } else {
        setHoveredItem(undefined)
      }
    },
    [flatbushIndex, flatbushItems, yScalar, view.offsetPx, lastDrawnOffsetPx],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredItem(undefined)
    setMousePosition(undefined)
    setLocalMousePos(undefined)
  }, [])

  // When offsetPx >= 0: use scroll offset for smooth scrolling between renders
  // When offsetPx < 0: use boundary offset to prevent content going past left edge
  const canvasOffset =
    view.offsetPx >= 0
      ? (lastDrawnOffsetPx ?? 0) - view.offsetPx
      : Math.max(0, -view.offsetPx)

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
        data-testid={`hic_canvas${drawn && !loading ? '_done' : ''}`}
        ref={cb}
        style={{
          width,
          height,
          position: 'absolute',
          left: canvasOffset,
        }}
        width={width * 2}
        height={height * 2}
      />
      {hoveredItem && localMousePos ? (
        <Crosshairs
          x={localMousePos.x}
          y={localMousePos.y}
          yScalar={yScalar}
          left={canvasOffset}
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
      {showLegend && maxScore > 0 ? (
        <HicColorLegend
          maxScore={maxScore}
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
    <BaseDisplayComponent model={model}>
      <HicCanvas model={model} />
    </BaseDisplayComponent>
  )
})

export default LinearHicReactComponent
