import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, stringify } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { createPortal } from 'react-dom'

import BaseDisplayComponent from './BaseDisplayComponent.tsx'
import LDColorLegend from './LDColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import RecombinationTrack from '../../shared/components/RecombinationTrack.tsx'

import type { LDFlatbushItem } from '../../LDRenderer/types.ts'
import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const SQRT2 = Math.sqrt(2)

const useStyles = makeStyles()(() => ({
  resizeHandle: {
    position: 'absolute',
    height: 6,
    background: 'transparent',
    zIndex: 2,
    '&:hover': {
      background: '#ccc',
    },
  },
  verticalGuide: {
    pointerEvents: 'none',
    width: 1,
    position: 'absolute',
    left: 0,
    top: 0,
    background: 'red',
    zIndex: 1001,
  },
  tooltipTarget: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  },
}))

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

  // Line thickness to match cell width
  const lineThickness = w

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
 * Vertical guides that extend through the entire LinearGenomeView.
 * Uses a portal to render at the TracksContainer level.
 */
function VerticalGuides({
  genomicX1,
  genomicX2,
  snp1,
  snp2,
  containerRef,
}: {
  genomicX1: number
  genomicX2: number
  snp1: { id: string; start: number; refName: string }
  snp2: { id: string; start: number; refName: string }
  containerRef: React.RefObject<HTMLDivElement | null>
}) {
  const { classes } = useStyles()
  const [tracksContainer, setTracksContainer] = useState<HTMLElement | null>(
    null,
  )

  // Find the TracksContainer by traversing up from our container
  useEffect(() => {
    if (containerRef.current) {
      let el: HTMLElement | null = containerRef.current
      while (el && el.dataset.testid !== 'tracksContainer') {
        el = el.parentElement
      }
      if (el) {
        setTracksContainer(el)
      }
    }
  }, [containerRef])

  if (!tracksContainer) {
    return null
  }

  return createPortal(
    <>
      <Tooltip
        open
        placement="top"
        title={stringify({ refName: snp2.refName, coord: snp2.start })}
        arrow
      >
        <div
          className={classes.tooltipTarget}
          style={{ transform: `translateX(${genomicX1}px)` }}
        />
      </Tooltip>
      <div
        className={classes.verticalGuide}
        style={{ transform: `translateX(${genomicX1}px)`, height: '100%' }}
      />
      <Tooltip
        open
        placement="top"
        title={stringify({ refName: snp1.refName, coord: snp1.start })}
        arrow
      >
        <div
          className={classes.tooltipTarget}
          style={{ transform: `translateX(${genomicX2}px)` }}
        />
      </Tooltip>
      <div
        className={classes.verticalGuide}
        style={{ transform: `translateX(${genomicX2}px)`, height: '100%' }}
      />
    </>,
    tracksContainer,
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
  canvasHeight,
}: {
  model: SharedLDModel
  canvasHeight: number
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
  } = model

  // When fitToHeight is false, use the natural triangle height
  const naturalHeight = width / 2 + lineZoneHeight
  const effectiveCanvasHeight = fitToHeight ? canvasHeight : naturalHeight

  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredItem, setHoveredItem] = useState<LDFlatbushItem>()
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
    [model, width, effectiveCanvasHeight],
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current || !flatbushIndex || !flatbushItems.length) {
        setHoveredItem(undefined)
        setMousePosition(undefined)
        setLocalMousePos(undefined)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top

      setMousePosition({ x: event.clientX, y: event.clientY })
      setLocalMousePos({ x: screenX, y: screenY })

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
    setLocalMousePos(undefined)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        cursor: hoveredItem && mousePosition ? 'crosshair' : undefined,
        position: 'relative',
        width,
        height: effectiveCanvasHeight,
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <canvas
        data-testid={`ld_canvas${drawn && !loading ? '_done' : ''}`}
        ref={cb}
        style={{
          width,
          height: effectiveCanvasHeight,
          position: 'absolute',
          left: 0,
          top: 0,
        }}
        width={width * 2}
        height={effectiveCanvasHeight * 2}
      />

      {hoveredItem
        ? (() => {
            // Calculate positions for crosshairs
            const region = view.dynamicBlocks.contentBlocks[0]
            if (!region) {
              return null
            }
            const bpPerPx = view.bpPerPx

            // Genomic positions
            const genomicX1 = (hoveredItem.snp2.start - region.start) / bpPerPx
            const genomicX2 = (hoveredItem.snp1.start - region.start) / bpPerPx

            return (
              <>
                <Crosshairs
                  hoveredItem={hoveredItem}
                  cellWidth={cellWidth}
                  genomicX1={genomicX1}
                  genomicX2={genomicX2}
                  yScalar={yScalar}
                  lineZoneHeight={lineZoneHeight}
                  tickHeight={model.tickHeight}
                  width={width}
                  height={effectiveCanvasHeight}
                />
                {model.showVerticalGuides ? (
                  <VerticalGuides
                    genomicX1={genomicX1}
                    genomicX2={genomicX2}
                    snp1={hoveredItem.snp1}
                    snp2={hoveredItem.snp2}
                    containerRef={containerRef}
                  />
                ) : null}
              </>
            )
          })()
        : null}

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
    </div>
  )
})

const LDDisplayContent = observer(function LDDisplayContent({
  model,
}: {
  model: SharedLDModel
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const { height, showLDTriangle, showRecombination, recombinationZoneHeight } =
    model

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

  const { ldCanvasHeight } = model

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* Recombination track at top */}
      {showRecombination ? (
        <div style={{ position: 'relative', height: recombinationZoneHeight }}>
          <RecombinationTrack
            model={model}
            width={width}
            height={recombinationZoneHeight}
          />
          {/* Resize handle overlapping bottom of recombination track */}
          {showLDTriangle ? (
            <ResizeHandle
              onDrag={delta => {
                model.setRecombinationZoneHeight(
                  recombinationZoneHeight + delta,
                )
                return delta
              }}
              className={classes.resizeHandle}
              style={{
                bottom: 0,
                left: 0,
                width: '100%',
                cursor: 'row-resize',
              }}
            />
          ) : null}
        </div>
      ) : null}

      {/* LD canvas below */}
      {showLDTriangle ? (
        <LDCanvas model={model} canvasHeight={ldCanvasHeight} />
      ) : null}
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
