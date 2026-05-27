import { useEffect, useRef, useState } from 'react'

import { CanvasDisplayWrapper, ErrorOverlay } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, max, useGpuBackend } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs.tsx'
import LDColorLegend from './LDColorLegend.tsx'
import { LDRenderer } from './LDRenderer.ts'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import VariantLabels from './VariantLabels.tsx'
import Wrapper from './Wrapper.tsx'
import RecombinationTrack from '../../shared/components/RecombinationTrack.tsx'
import RecombinationYScaleBar from '../../shared/components/RecombinationYScaleBar.tsx'

import type { LDFlatbushItem } from '../../RenderLDDataRPC/types.ts'
import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

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

function RecombinationOverlay({
  model,
  width,
  recombHeight,
  top,
  useGenomicPositions,
  regionStart,
  bpPerPx,
}: {
  model: SharedLDModel
  width: number
  recombHeight: number
  top: number
  useGenomicPositions: boolean
  regionStart?: number
  bpPerPx: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top,
        width,
        height: recombHeight,
        pointerEvents: 'none',
      }}
    >
      <RecombinationTrack
        model={model}
        width={width}
        height={recombHeight}
        useGenomicPositions={useGenomicPositions}
        regionStart={regionStart}
        bpPerPx={bpPerPx}
      />
      <RecombinationYScaleBar
        height={recombHeight}
        maxValue={max(model.recombination!.values, 0.1)}
      />
    </div>
  )
}

const LDCanvas = observer(function LDCanvas({
  model,
}: {
  model: SharedLDModel
}) {
  const view = getContainingView(model) as LGV
  const width = view.totalWidthPxWithoutBorders
  const {
    rpcData,
    showLegend,
    ldMetric,
    lineZoneHeight,
    fitToHeight,
    ldCanvasHeight,
    useGenomicPositions,
    signedLD,
    isLoading,
    effectiveLineZoneHeight,
  } = model

  const triangleHeight = width / 2
  const canvasOnlyHeight = fitToHeight ? ldCanvasHeight : triangleHeight
  const containerHeight = canvasOnlyHeight + effectiveLineZoneHeight

  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredItem, setHoveredItem] = useState<LDFlatbushItem>()
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
  }>()

  const { canvasRef, error, retry } = useGpuBackend(LDRenderer, model)

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

  const { viewOffsetX } = model.renderTransform

  useEffect(() => {
    if (
      genomicX1 !== undefined &&
      genomicX2 !== undefined &&
      model.showVerticalGuides
    ) {
      view.setVolatileGuides([
        { xPos: genomicX1 + viewOffsetX },
        { xPos: genomicX2 + viewOffsetX },
      ])
    } else {
      view.setVolatileGuides([])
    }
    return () => {
      view.setVolatileGuides([])
    }
  }, [genomicX1, genomicX2, model.showVerticalGuides, view, viewOffsetX])

  const onMouseMove = (event: React.MouseEvent) => {
    const container = containerRef.current
    if (!container || isLoading) {
      setHoveredItem(undefined)
      setMousePosition(undefined)
      return
    }
    const rect = container.getBoundingClientRect()
    setMousePosition({ x: event.clientX, y: event.clientY })
    setHoveredItem(
      model.hitTest(event.clientX - rect.left, event.clientY - rect.top),
    )
  }

  const onMouseLeave = () => {
    setHoveredItem(undefined)
    setMousePosition(undefined)
  }

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width}
        height={containerHeight}
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
          left: 0,
          top: effectiveLineZoneHeight,
        }}
      />

      {hoveredItem && genomicX1 !== undefined && genomicX2 !== undefined ? (
        <Crosshairs
          model={model}
          hoveredItem={hoveredItem}
          genomicX1={genomicX1}
          genomicX2={genomicX2}
          height={containerHeight}
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
        <RecombinationOverlay
          model={model}
          width={width}
          recombHeight={
            useGenomicPositions ? effectiveLineZoneHeight : lineZoneHeight / 2
          }
          top={useGenomicPositions ? 0 : lineZoneHeight / 2}
          useGenomicPositions={useGenomicPositions}
          regionStart={region?.start}
          bpPerPx={bpPerPx}
        />
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
  const width = view.totalWidthPxWithoutBorders
  const { height, showLDTriangle, showRecombination } = model

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

  // Gap shift is now folded into viewOffsetX inside the renderer (matches
  // plugins/hic). Wrapper div stays at left:0 — full viewport width.
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
    <CanvasDisplayWrapper model={model}>
      <LDDisplayContent model={model} />
    </CanvasDisplayWrapper>
  )
})

export default LDDisplayComponent
