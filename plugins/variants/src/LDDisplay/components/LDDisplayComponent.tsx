import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { observer } from 'mobx-react'

import BaseDisplayComponent from './BaseDisplayComponent.tsx'
import LDColorLegend from './LDColorLegend.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import VariantLabels from './VariantLabels.tsx'
import {
  WebGLLDRenderer,
  generateLDColorRamp,
} from './WebGLLDRenderer.ts'
import Wrapper from './Wrapper.tsx'
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

  const toScreen = (x: number, y: number) => {
    const rx = (x + y) / SQRT2
    const ry = (y - x) / SQRT2
    return { x: rx, y: ry * yScalar + lineZoneHeight }
  }

  let hoveredCenter: { x: number; y: number }
  let snpJPos: { x: number; y: number }
  let snpIPos: { x: number; y: number }

  if (useGenomicPositions && snps.length > 0) {
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
      const lastSnpPos = snps[snps.length - 1]!.start
      return (lastSnpPos + 50 * bpPerPx - regionStart) / bpPerPx / SQRT2
    }

    const jBoundary = getBoundary(j)
    const iBoundary = getBoundary(i)
    const jNextBoundary = getNextBoundary(j)
    const iNextBoundary = getNextBoundary(i)

    const cellCenterX = (jBoundary + jNextBoundary) / 2
    const cellCenterY = (iBoundary + iNextBoundary) / 2
    hoveredCenter = toScreen(cellCenterX, cellCenterY)

    snpJPos = { x: genomicX1, y: lineZoneHeight }
    snpIPos = { x: genomicX2, y: lineZoneHeight }
  } else {
    const w = cellWidth

    hoveredCenter = toScreen((j + 0.5) * w, (i + 0.5) * w)

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
      <path
        stroke="rgba(0, 0, 0, 0.6)"
        strokeWidth={1}
        fill="none"
        d={`M ${snpJPos.x} ${snpJPos.y} L ${hoveredCenter.x} ${hoveredCenter.y} L ${snpIPos.x} ${snpIPos.y}`}
      />
      <g stroke="#e00" strokeWidth="1.5" fill="none">
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
        <path d={`M ${genomicX1} 0 L ${genomicX1} ${tickHeight}`} />
        <path d={`M ${genomicX2} 0 L ${genomicX2} ${tickHeight}`} />
      </g>
    </svg>
  )
}

function screenToUnrotated(
  screenX: number,
  screenY: number,
  yScalar: number,
  lineZoneHeight: number,
): { x: number; y: number } {
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
    rpcData,
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

  const triangleHeight = width / 2
  const canvasOnlyHeight = fitToHeight ? ldCanvasHeight : triangleHeight
  const containerHeight = canvasOnlyHeight + lineZoneHeight

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLLDRenderer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredItem, setHoveredItem] = useState<LDFlatbushItem>()
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
  }>()
  const [glError, setGlError] = useState<string>()

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

  const canvasOffset =
    view.offsetPx >= 0
      ? (lastDrawnOffsetPx ?? 0) - view.offsetPx
      : Math.max(0, -view.offsetPx)

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

  const flatbushIndex = useMemo(
    () => (flatbush ? Flatbush.from(flatbush) : null),
    [flatbush],
  )

  // Initialize WebGL renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    try {
      rendererRef.current = new WebGLLDRenderer(canvas)
    } catch (e) {
      setGlError(e instanceof Error ? e.message : 'WebGL initialization failed')
    }

    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  // Upload data when rpcData changes
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !rpcData) {
      return
    }

    renderer.uploadData({
      positions: rpcData.positions,
      cellSizes: rpcData.cellSizes,
      ldValues: rpcData.ldValues,
      numCells: rpcData.numCells,
    })
  }, [rpcData])

  // Render when data, metric, signedLD, or dimensions change
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !rpcData) {
      return
    }

    renderer.uploadColorRamp(generateLDColorRamp(rpcData.metric, rpcData.signedLD))
    renderer.render({
      yScalar: rpcData.yScalar,
      canvasWidth: width,
      canvasHeight: canvasOnlyHeight,
      signedLD: rpcData.signedLD,
    })
  }, [rpcData, width, canvasOnlyHeight])

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const container = containerRef.current
      if (!container || !flatbushIndex || !flatbushItems.length) {
        setHoveredItem(undefined)
        setMousePosition(undefined)
        return
      }

      const rect = container.getBoundingClientRect()
      const mouseCanvasOffset = canvasOffset
      const screenX = event.clientX - rect.left - mouseCanvasOffset
      const screenY = event.clientY - rect.top

      setMousePosition({ x: event.clientX, y: event.clientY })

      if (screenY < lineZoneHeight) {
        setHoveredItem(undefined)
        return
      }

      const { x, y } = screenToUnrotated(
        screenX,
        screenY,
        yScalar,
        lineZoneHeight,
      )

      const results = flatbushIndex.search(x - 1, y - 1, x + 1, y + 1)

      if (results.length > 0) {
        const item = flatbushItems[results[0]!]
        setHoveredItem(item)
      } else {
        setHoveredItem(undefined)
      }
    },
    [flatbushIndex, flatbushItems, yScalar, lineZoneHeight, canvasOffset],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredItem(undefined)
    setMousePosition(undefined)
  }, [])

  if (glError) {
    return (
      <div style={{ color: 'red', padding: 10 }}>WebGL Error: {glError}</div>
    )
  }

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
        data-testid={`ld_canvas${rpcData ? '_done' : ''}`}
        ref={canvasRef}
        style={{
          width,
          height: canvasOnlyHeight,
          position: 'absolute',
          left: canvasOffset,
          top: lineZoneHeight,
        }}
        width={width}
        height={canvasOnlyHeight}
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
      {model.showRecombination && model.recombination ? (
        <div
          style={{
            position: 'absolute',
            left: canvasOffset,
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
