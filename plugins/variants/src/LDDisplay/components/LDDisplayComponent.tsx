import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import BaseDisplayComponent from './BaseDisplayComponent.tsx'
import LDColorLegend from './LDColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition, {
  VariantLabels,
  Wrapper,
} from './LinesConnectingMatrixToGenomicPosition.tsx'
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
  signedLD,
}: {
  item: LDFlatbushItem
  x: number
  y: number
  ldMetric: string
  signedLD: boolean
}) {
  // Show appropriate metric label based on signed/unsigned mode
  let metricLabel: string
  if (ldMetric === 'dprime') {
    metricLabel = "D'"
  } else {
    metricLabel = signedLD ? 'R' : 'R²'
  }

  return (
    <BaseTooltip clientPoint={{ x: x + 15, y }}>
      <div>{item.snp1.id}</div>
      <div>{item.snp2.id}</div>
      <div>
        {metricLabel}: {item.ldValue.toFixed(3)}
      </div>
    </BaseTooltip>
  )
}

/**
 * Draw V-shape highlight from the hovered cell to the matrix diagonal,
 * plus connecting lines to genomic positions.
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
  useGenomicPositions,
  snps,
  regionStart,
  bpPerPx,
  canvasOffset,
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
  useGenomicPositions: boolean
  snps: { start: number }[]
  regionStart: number
  bpPerPx: number
  canvasOffset: number
}) {
  const { i, j } = hoveredItem

  // Transform a point from unrotated cell coordinates to screen coordinates
  // Canvas transformations: rotate(-45°), scale(1, yScalar), translate(0, lineZoneHeight)
  const toScreen = (x: number, y: number) => {
    // Rotate -45 degrees
    const rx = (x + y) / SQRT2
    const ry = (y - x) / SQRT2
    // Scale Y and translate
    return { x: rx, y: ry * yScalar + lineZoneHeight }
  }

  // Calculate positions based on mode
  let hoveredCenter: { x: number; y: number }
  let snpJPos: { x: number; y: number }
  let snpIPos: { x: number; y: number }

  if (useGenomicPositions && snps.length > 0) {
    // Use midpoint boundaries (matching makeImageData.ts)
    // Each SNP's cell extends from the midpoint to the previous SNP
    // to the midpoint to the next SNP
    const getBoundary = (idx: number) => {
      const snpPos = snps[idx]!.start
      const prevPos = idx > 0 ? snps[idx - 1]!.start : regionStart
      const boundaryPos = (prevPos + snpPos) / 2
      return (boundaryPos - regionStart) / bpPerPx / SQRT2
    }

    const getNextBoundary = (idx: number) => {
      if (idx + 1 < snps.length) {
        const snpPos = snps[idx]!.start
        const nextPos = snps[idx + 1]!.start
        return ((snpPos + nextPos) / 2 - regionStart) / bpPerPx / SQRT2
      }
      // Small fixed offset past the last SNP (50px)
      const lastSnpPos = snps[snps.length - 1]!.start
      return (lastSnpPos + 50 * bpPerPx - regionStart) / bpPerPx / SQRT2
    }

    const jBoundary = getBoundary(j)
    const iBoundary = getBoundary(i)
    const jNextBoundary = getNextBoundary(j)
    const iNextBoundary = getNextBoundary(i)

    // Cell center for the V-shape apex
    const cellCenterX = (jBoundary + jNextBoundary) / 2
    const cellCenterY = (iBoundary + iNextBoundary) / 2
    hoveredCenter = toScreen(cellCenterX, cellCenterY)

    // Diagonal positions should connect to the vertical guides at genomicX1/genomicX2
    // The diagonal after rotation is at y = lineZoneHeight, x = genomicX
    snpJPos = { x: genomicX1, y: lineZoneHeight }
    snpIPos = { x: genomicX2, y: lineZoneHeight }
  } else {
    // Uniform cell positioning
    const w = cellWidth

    // Cell center for hovered cell
    hoveredCenter = toScreen((j + 0.5) * w, (i + 0.5) * w)

    // Diagonal positions at cell centers (matching where connecting lines attach)
    snpJPos = toScreen((j + 0.5) * w, (j + 0.5) * w)
    snpIPos = toScreen((i + 0.5) * w, (i + 0.5) * w)
  }

  return (
    <svg
      style={{
        position: 'absolute',
        left: canvasOffset,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      {/* V-shape: single line from snp j through hovered cell to snp i */}
      <path
        stroke="rgba(0, 0, 0, 0.6)"
        strokeWidth={1}
        fill="none"
        d={`M ${snpJPos.x} ${snpJPos.y} L ${hoveredCenter.x} ${hoveredCenter.y} L ${snpIPos.x} ${snpIPos.y}`}
      />
      {/* Highlighted connecting lines from matrix to genome */}
      <g stroke="#e00" strokeWidth="1.5" fill="none">
        {/* Diagonal lines ending at top of tick marks (only when not using genomic positions) */}
        {!useGenomicPositions ? (
          <>
            <path
              d={`M ${snpJPos.x} ${snpJPos.y} L ${genomicX1} ${tickHeight}`}
            />
            <path
              d={`M ${snpIPos.x} ${snpIPos.y} L ${genomicX2} ${tickHeight}`}
            />
          </>
        ) : null}
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
    useGenomicPositions,
    snps,
    lastDrawnOffsetPx,
    signedLD,
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
  // These are raw pixel positions from region start - no offset adjustment needed
  // because the SVG/canvas is already positioned at Math.max(0, -offsetPx)
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

  // When offsetPx >= 0: use scroll offset for smooth scrolling between renders
  // When offsetPx < 0: use boundary offset to prevent content going past left edge
  const canvasOffset =
    view.offsetPx >= 0
      ? (lastDrawnOffsetPx ?? 0) - view.offsetPx
      : Math.max(0, -view.offsetPx)

  // Update volatile guides when hovered item changes
  // Add canvas offset to guide positions
  const guideOffset = canvasOffset
  useEffect(() => {
    if (
      genomicX1 !== undefined &&
      genomicX2 !== undefined &&
      model.showVerticalGuides
    ) {
      view.setVolatileGuides([
        { xPos: genomicX1 + guideOffset },
        { xPos: genomicX2 + guideOffset },
      ])
    } else {
      view.setVolatileGuides([])
    }
    return () => {
      view.setVolatileGuides([])
    }
  }, [genomicX1, genomicX2, model.showVerticalGuides, view, guideOffset])

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
      // Account for canvas offset (same logic as canvas positioning)
      const mouseCanvasOffset =
        view.offsetPx >= 0
          ? (lastDrawnOffsetPx ?? 0) - view.offsetPx
          : Math.max(0, -view.offsetPx)
      const screenX = event.clientX - rect.left - mouseCanvasOffset
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
    [
      flatbushIndex,
      flatbushItems,
      yScalar,
      lineZoneHeight,
      view.offsetPx,
      lastDrawnOffsetPx,
    ],
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
        overflow: 'hidden',
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
          left: canvasOffset,
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
          useGenomicPositions={useGenomicPositions}
          snps={snps}
          regionStart={region?.start ?? 0}
          bpPerPx={bpPerPx}
          canvasOffset={canvasOffset}
        />
      ) : null}

      {hoveredItem && mousePosition ? (
        <LDTooltip
          item={hoveredItem}
          x={mousePosition.x}
          y={mousePosition.y}
          ldMetric={ldMetric}
          signedLD={signedLD}
        />
      ) : null}
      {showLegend ? (
        <LDColorLegend ldMetric={ldMetric} signedLD={signedLD} />
      ) : null}
      {useGenomicPositions ? (
        <Wrapper model={model}>
          <VariantLabels model={model} />
        </Wrapper>
      ) : (
        <LinesConnectingMatrixToGenomicPosition model={model} />
      )}
      {/* Recombination track overlaid at bottom of line zone */}
      {model.showRecombination && model.recombination ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: lineZoneHeight / 2,
            width,
            height: lineZoneHeight / 2,
            pointerEvents: 'none',
          }}
        >
          <RecombinationTrack
            model={model}
            width={width}
            height={lineZoneHeight / 2}
            useGenomicPositions={useGenomicPositions}
            regionStart={region?.start}
            bpPerPx={bpPerPx}
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
