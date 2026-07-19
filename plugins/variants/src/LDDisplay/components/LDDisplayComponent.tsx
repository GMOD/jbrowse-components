import { useEffect, useRef, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getBpDisplayStr, getContainingView, maxFinite } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs.tsx'
import FocalSnpHighlight from './FocalSnpHighlight.tsx'
import LDColorLegend from './LDColorLegend.tsx'
import { LDRenderer } from './LDRenderer.ts'
import LDStatusBar from './LDStatusBar.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'
import VariantLabels from './VariantLabels.tsx'
import Wrapper from './Wrapper.tsx'
import RecombinationTrack from '../../shared/components/RecombinationTrack.tsx'
import RecombinationYScaleBar from '../../shared/components/RecombinationYScaleBar.tsx'

import type { LDFlatbushItem } from '../../RenderLDDataRPC/types.ts'
import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function SnpRow({ snp }: { snp: LDFlatbushItem['snp1'] }) {
  return (
    <div>
      {snp.id ? <b>{snp.id} </b> : null}
      {snp.refName}:{(snp.start + 1).toLocaleString()}
      {snp.maf === undefined ? null : ` · MAF ${snp.maf.toFixed(3)}`}
    </div>
  )
}

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
  const distance = Math.abs(item.snp1.start - item.snp2.start)
  // Sign only carries meaning when signed values were requested; positive =
  // coupling (alleles co-occur), negative = repulsion (opposite haplotypes).
  const phase =
    signedLD && item.ldValue !== 0
      ? item.ldValue > 0
        ? ' (coupling)'
        : ' (repulsion)'
      : ''

  return (
    <BaseTooltip clientPoint={{ x: x + 15, y }}>
      <SnpRow snp={item.snp1} />
      <SnpRow snp={item.snp2} />
      <div>
        {metricLabel}: {item.ldValue.toFixed(3)}
        {phase}
      </div>
      <div>Distance: {getBpDisplayStr(distance)}</div>
    </BaseTooltip>
  )
}

const RecombinationOverlay = observer(function RecombinationOverlay({
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
        maxValue={maxFinite(model.recombination!.values, 0.1)}
      />
    </div>
  )
})

const LDCanvas = observer(function LDCanvas({
  model,
  canvasRef,
}: {
  model: SharedLDModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const view = getContainingView(model) as LGV
  const width = view.totalWidthPxWithoutBorders
  const {
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

  // Click a cell to pin its row SNP as focal (highlights that SNP's LD with
  // every other variant); click empty space to clear.
  const onClick = (event: React.MouseEvent) => {
    const container = containerRef.current
    if (!container || isLoading) {
      return
    }
    const rect = container.getBoundingClientRect()
    const item = model.hitTest(
      event.clientX - rect.left,
      event.clientY - rect.top,
    )
    model.setFocalSnp(item?.snp1)
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
      onClick={onClick}
    >
      <canvas
        data-testid="ld_canvas"
        ref={canvasRef}
        style={{
          width,
          height: canvasOnlyHeight,
          position: 'absolute',
          left: 0,
          top: effectiveLineZoneHeight,
        }}
      />

      {model.focalSnpIndex >= 0 ? (
        <FocalSnpHighlight model={model} height={containerHeight} />
      ) : null}

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
      <LDStatusBar model={model} />
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

const EmptyState = observer(function EmptyState({
  model,
}: {
  model: SharedLDModel
}) {
  const view = getContainingView(model) as LGV
  return (
    <div
      style={{
        width: view.totalWidthPxWithoutBorders,
        height: model.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
      }}
    >
      Enable LD triangle in display settings to view data
    </div>
  )
})

const LDDisplayComponent = observer(function LDDisplayComponent({
  model,
}: {
  model: SharedLDModel
}) {
  return (
    <DisplayChrome model={model} factory={LDRenderer} testid="ld-display">
      {({ canvasRef }) =>
        model.showLDTriangle ? (
          <LDCanvas model={model} canvasRef={canvasRef} />
        ) : (
          <EmptyState model={model} />
        )
      }
    </DisplayChrome>
  )
})

export default LDDisplayComponent
