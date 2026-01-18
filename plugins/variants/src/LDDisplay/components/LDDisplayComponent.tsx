import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import BaseDisplayComponent from './BaseDisplayComponent.tsx'
import LDColorLegend from './LDColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import RecombinationTrack from '../../shared/components/RecombinationTrack.tsx'
import RecombinationYScaleBar from '../../shared/components/RecombinationYScaleBar.tsx'

import type { LDFlatbushItem } from '../../LDRenderer/types.ts'
import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const SQRT2 = Math.sqrt(2)

function LDTooltip({
  item,
  x,
  y,
  ldMetric,
}: {
  item: LDFlatbushItem
  x: number
  y: number
  ldMetric: string
}) {
  return (
    <BaseTooltip clientPoint={{ x: x + 15, y }}>
      <div>{item.snp1.id}</div>
      <div>{item.snp2.id}</div>
      <div>
        {ldMetric === 'dprime' ? "D'" : 'R²'}: {item.ldValue.toFixed(3)}
      </div>
    </BaseTooltip>
  )
}

/**
 * Draw highlighted cells along the V-shape path from the hovered cell
 * back to the matrix column positions at the top of the heatmap.
 * Uses thick lines matching cell width instead of individual squares.
 */
function Crosshairs({
  hoveredItem,
  cellWidth,
  genomicX1,
  genomicX2,
  yScalar,
  lineZoneHeight,
  tickHeight,
  width,
  height,
}: {
  hoveredItem: LDFlatbushItem
  cellWidth: number
  genomicX1: number
  genomicX2: number
  yScalar: number
  lineZoneHeight: number
  tickHeight: number
  width: number
  height: number
}) {
  const { i, j } = hoveredItem
  const w = cellWidth

  // Transform a point from unrotated cell coordinates to screen coordinates
  // Canvas transformations: rotate(-45°), scale(1, yScalar), translate(0, lineZoneHeight)
  const toScreen = (x: number, y: number) => {
    // Rotate -45 degrees
    const rx = (x + y) / SQRT2
    const ry = (y - x) / SQRT2
    // Scale Y and translate
    return { x: rx, y: ry * yScalar + lineZoneHeight }
  }

  // Cell centers for the V-shape endpoints
  // The hovered cell is at (i, j), its center in unrotated coords is ((j+0.5)*w, (i+0.5)*w)
  const hoveredCenter = toScreen((j + 0.5) * w, (i + 0.5) * w)

  // Left arm goes to snp j (diagonal position j,j)
  const snpJCenter = toScreen((j + 0.5) * w, (j + 0.5) * w)

  // Right arm goes to snp i (diagonal position i,i)
  const snpICenter = toScreen((i + 0.5) * w, (i + 0.5) * w)

  // Line thickness calculated to match the perpendicular extent of cells
  // in screen space after rotation and yScalar transformation.
  // Formula: w * yScalar * sqrt(2) / sqrt(1 + yScalar^2)
  const lineThickness = (w * yScalar * SQRT2) / Math.sqrt(1 + yScalar * yScalar)

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
      {/* V-shape with thick lines matching cell width */}
      <g
        stroke="rgba(0, 0, 0, 0.3)"
        strokeWidth={lineThickness}
        fill="none"
        strokeLinecap="square"
      >
        {/* Left arm: from snp j down to hovered cell */}
        <path
          d={`M ${snpJCenter.x} ${snpJCenter.y} L ${hoveredCenter.x} ${hoveredCenter.y}`}
        />
        {/* Right arm: from snp i down to hovered cell */}
        <path
          d={`M ${snpICenter.x} ${snpICenter.y} L ${hoveredCenter.x} ${hoveredCenter.y}`}
        />
      </g>
      {/* Highlighted connecting lines from matrix to genome */}
      <g stroke="#e00" strokeWidth="1.5" fill="none">
        {/* Diagonal lines ending at top of tick marks */}
        <path
          d={`M ${snpJCenter.x} ${snpJCenter.y} L ${genomicX1} ${tickHeight}`}
        />
        <path
          d={`M ${snpICenter.x} ${snpICenter.y} L ${genomicX2} ${tickHeight}`}
        />
        {/* Vertical tick marks */}
        <path d={`M ${genomicX1} 0 L ${genomicX1} ${tickHeight}`} />
        <path d={`M ${genomicX2} 0 L ${genomicX2} ${tickHeight}`} />
      </g>
    </svg>
  )
}

/**
 * Transform screen coordinates to the unrotated coordinate space.
 * The canvas is rotated by -45 degrees, so we apply the inverse rotation (+45 degrees).
 * Also accounts for the yScalar transformation and lineZoneHeight offset.
 */
function screenToUnrotated(
  screenX: number,
  screenY: number,
  yScalar: number,
  lineZoneHeight: number,
): { x: number; y: number } {
  // Subtract lineZoneHeight since the matrix is translated down by that amount
  const matrixY = screenY - lineZoneHeight
  const scaledY = matrixY / yScalar
  const x = (screenX - scaledY) / SQRT2
  const y = (screenX + scaledY) / SQRT2
  return { x, y }
}

const LDCanvas = observer(function LDCanvas({
  model,
}: {
  model: SharedLDModel
}) {
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const {
    drawn,
    loading,
    flatbush,
    flatbushItems,
    yScalar,
    cellWidth,
    showLegend,
    ldMetric,
    lineZoneHeight,
    fitToHeight,
    ldCanvasHeight,
  } = model

  // Container height includes lineZoneHeight + triangle
  // Canvas height is just the triangle (lineZoneHeight is handled by CSS positioning)
  // ldCanvasHeight already has lineZoneHeight subtracted
  const triangleHeight = width / 2
  const canvasOnlyHeight = fitToHeight ? ldCanvasHeight : triangleHeight
  const containerHeight = canvasOnlyHeight + lineZoneHeight

  const [hoveredItem, setHoveredItem] = useState<LDFlatbushItem>()
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>()
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate genomic positions for hovered item
  const region = view.dynamicBlocks.contentBlocks[0]
  const bpPerPx = view.bpPerPx
  const genomicX1 =
    hoveredItem && region
      ? (hoveredItem.snp2.start - region.start) / bpPerPx
      : undefined
  const genomicX2 =
    hoveredItem && region
      ? (hoveredItem.snp1.start - region.start) / bpPerPx
      : undefined

  // Update volatile guides when hovered item changes
  useEffect(() => {
    if (
      genomicX1 !== undefined &&
      genomicX2 !== undefined &&
      model.showVerticalGuides
    ) {
      view.setVolatileGuides([{ xPos: genomicX1 }, { xPos: genomicX2 }])
    } else {
      view.setVolatileGuides([])
    }
    return () => {
      view.setVolatileGuides([])
    }
  }, [genomicX1, genomicX2, model.showVerticalGuides, view])

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
    [model, width, canvasOnlyHeight],
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const container = containerRef.current
      if (!container || !flatbushIndex || !flatbushItems.length) {
        setHoveredItem(undefined)
        setMousePosition(undefined)
        return
      }

      const rect = container.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top

      setMousePosition({ x: event.clientX, y: event.clientY })

      // Only query if we're below the line zone
      if (screenY < lineZoneHeight) {
        setHoveredItem(undefined)
        return
      }

      // Transform screen coordinates to unrotated space for Flatbush query
      const { x, y } = screenToUnrotated(
        screenX,
        screenY,
        yScalar,
        lineZoneHeight,
      )

      // Query Flatbush with a small region around the transformed point
      const results = flatbushIndex.search(x - 1, y - 1, x + 1, y + 1)

      if (results.length > 0) {
        const item = flatbushItems[results[0]!]
        setHoveredItem(item)
      } else {
        setHoveredItem(undefined)
      }
    },
    [flatbushIndex, flatbushItems, yScalar, lineZoneHeight],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredItem(undefined)
    setMousePosition(undefined)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        cursor: hoveredItem && mousePosition ? 'crosshair' : undefined,
        position: 'relative',
        width,
        height: containerHeight,
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <canvas
        data-testid={`ld_canvas${drawn && !loading ? '_done' : ''}`}
        ref={cb}
        style={{
          width,
          height: canvasOnlyHeight,
          position: 'absolute',
          left: 0,
          top: lineZoneHeight,
        }}
        width={width * 2}
        height={canvasOnlyHeight * 2}
      />

      {hoveredItem && genomicX1 !== undefined && genomicX2 !== undefined ? (
        <Crosshairs
          hoveredItem={hoveredItem}
          cellWidth={cellWidth}
          genomicX1={genomicX1}
          genomicX2={genomicX2}
          yScalar={yScalar}
          lineZoneHeight={lineZoneHeight}
          tickHeight={model.tickHeight}
          width={width}
          height={containerHeight}
        />
      ) : null}

      {hoveredItem && mousePosition ? (
        <LDTooltip
          item={hoveredItem}
          x={mousePosition.x}
          y={mousePosition.y}
          ldMetric={ldMetric}
        />
      ) : null}
      {showLegend ? <LDColorLegend ldMetric={ldMetric} /> : null}
      <LinesConnectingMatrixToGenomicPosition model={model} />
      {/* Recombination track overlaid at bottom of line zone */}
      {model.showRecombination && model.recombination ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: lineZoneHeight / 2,
            width,
            height: lineZoneHeight / 2,
          }}
        >
          <RecombinationTrack
            model={model}
            width={width}
            height={lineZoneHeight / 2}
          />
          <RecombinationYScaleBar
            height={lineZoneHeight / 2}
            maxValue={Math.max(...model.recombination.values, 0.1)}
          />
        </div>
      ) : null}
    </div>
  )
})

const LDDisplayContent = observer(function LDDisplayContent({
  model,
}: {
  model: SharedLDModel
}) {
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const { height, showLDTriangle, showRecombination } = model

  // Show message when zoomed out
  if (view.bpPerPx > 1000) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
        }}
      >
        Zoom in to see LD data
      </div>
    )
  }

  // Show message when nothing is enabled
  if (!showLDTriangle && !showRecombination) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
        }}
      >
        Enable LD triangle or recombination track in display settings
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* LD canvas with recombination track overlaid on line zone */}
      {showLDTriangle ? <LDCanvas model={model} /> : null}
    </div>
  )
})

const LDDisplayComponent = observer(function LDDisplayComponent({
  model,
}: {
  model: SharedLDModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <LDDisplayContent model={model} />
    </BaseDisplayComponent>
  )
})

export default LDDisplayComponent
