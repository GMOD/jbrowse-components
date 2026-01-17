import { useCallback, useMemo, useRef, useState } from 'react'

import { ResizeHandle } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import BaseDisplayComponent from './BaseDisplayComponent.tsx'
import LDColorLegend from './LDColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import RecombinationTrack from '../../shared/components/RecombinationTrack.tsx'

import type { LDFlatbushItem } from '../../LDRenderer/types.ts'
import type { LDDisplayModel } from '../model.ts'
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
 * Draw crosshair lines from the hovered matrix cell back to the matrix column positions
 * at the top of the heatmap, and highlight the connecting lines to the genome.
 */
function Crosshairs({
  localX,
  localY,
  genomicX1,
  genomicX2,
  yScalar,
  lineZoneHeight,
  width,
  height,
}: {
  localX: number
  localY: number
  genomicX1: number
  genomicX2: number
  yScalar: number
  lineZoneHeight: number
  width: number
  height: number
}) {
  const matrixY = localY - lineZoneHeight
  const dx = matrixY / yScalar
  const matrixX1 = localX - dx
  const matrixX2 = localX + dx
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
      {/* V-shape from matrix column positions to hovered point */}
      <g stroke="#000" strokeWidth="1" fill="none">
        <path
          d={`M ${matrixX1} ${lineZoneHeight} L ${localX} ${localY} L ${matrixX2} ${lineZoneHeight}`}
        />
      </g>
      {/* Highlighted connecting lines from matrix to genome */}
      <g stroke="#e00" strokeWidth="1.5" fill="none">
        <path d={`M ${matrixX1} ${lineZoneHeight} L ${genomicX1} 0`} />
        <path d={`M ${matrixX2} ${lineZoneHeight} L ${genomicX2} 0`} />
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
  canvasHeight,
}: {
  model: LDDisplayModel
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
    showLegend,
    ldMetric,
    lineZoneHeight,
  } = model

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
    [model, width, canvasHeight],
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
        height: canvasHeight,
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <canvas
        data-testid={`ld_canvas${drawn && !loading ? '_done' : ''}`}
        ref={cb}
        style={{
          width,
          height: canvasHeight,
          position: 'absolute',
          left: 0,
          top: 0,
        }}
        width={width * 2}
        height={canvasHeight * 2}
      />

      {hoveredItem && localMousePos
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
              <Crosshairs
                localX={localMousePos.x}
                localY={localMousePos.y}
                genomicX1={genomicX1}
                genomicX2={genomicX2}
                yScalar={yScalar}
                lineZoneHeight={lineZoneHeight}
                width={width}
                height={canvasHeight}
              />
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
  model: LDDisplayModel
}) {
  const { classes } = useStyles()
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const {
    height,
    showLDTriangle,
    showRecombination,
    recombinationZoneHeight,
  } = model

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
                model.setRecombinationZoneHeight(recombinationZoneHeight + delta)
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
  model: LDDisplayModel
}) {
  return (
    <BaseDisplayComponent model={model}>
      <LDDisplayContent model={model} />
    </BaseDisplayComponent>
  )
})

export default LDDisplayComponent
