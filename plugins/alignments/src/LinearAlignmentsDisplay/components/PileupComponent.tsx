import { useEffect } from 'react'
import type React from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { ErrorBar, ResizeHandle } from '@jbrowse/core/ui'
import { clamp, getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import PileupArcsOverlay from './PileupArcsOverlay.tsx'
import SashimiArcsOverlay from './SashimiArcsOverlay.tsx'
import TlenAxisLabel from './TlenAxisLabel.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import {
  startDocumentDrag,
  useAbortableRef,
} from './alignmentComponentUtils.ts'
import { formatChainTooltip, formatFeatureTooltip } from './tooltipUtils.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

const useStyles = makeStyles()({
  scrollbarTrack: {
    position: 'absolute' as const,
    right: 0,
    width: 12,
    cursor: 'default',
    zIndex: 10,
    '&:hover > *': {
      background: 'rgba(0,0,0,0.55)',
    },
  },
  scrollbarThumb: {
    position: 'absolute' as const,
    right: 2,
    width: 6,
    borderRadius: 3,
    background: 'rgba(0,0,0,0.3)',
    pointerEvents: 'none' as const,
  },
  resizeHandle: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: YSCALEBAR_LABEL_OFFSET,
    zIndex: 10,
  },
})

const PileupComponent = observer(function PileupComponent({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { error, regionTooLarge, height } = model

  if (error || regionTooLarge) {
    return (
      <div style={{ position: 'relative', width: '100%', height }}>
        {error ? (
          <ErrorBar
            error={error}
            onRetry={() => {
              model.reload()
            }}
          />
        ) : (
          model.regionCannotBeRendered()
        )}
      </div>
    )
  }

  return <PileupInner model={model} />
})

const PileupInner = observer(function PileupInner({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const base = useAlignmentsBase(model)
  const {
    canvas,
    canvasRef,
    width,
    contrastMap,
    handleMouseDown,
    handleMouseLeave,
    handleContextMenu,
    processMouseMove,
    processClick,
  } = base
  const { classes } = useStyles()

  const view = getContainingView(model) as { scrollZoom?: boolean }
  const { scrollZoom } = view

  useEffect(() => {
    if (!canvas) {
      return
    }
    const handler = (e: WheelEvent) => {
      if (scrollZoom && !e.shiftKey) {
        return
      }
      const { scrollableHeight, pileupViewportHeight, currentRangeY } = model
      if (scrollableHeight <= 0) {
        return
      }
      let dy = e.deltaY
      if (e.deltaMode === 1) {
        dy *= 40
      } else if (e.deltaMode === 2) {
        dy *= pileupViewportHeight
      }
      const curScroll = currentRangeY[0]
      const newScroll = clamp(curScroll + dy, 0, scrollableHeight)
      if (newScroll !== curScroll) {
        e.preventDefault()
        model.setCurrentRangeY([newScroll, newScroll + pileupViewportHeight])
      }
    }
    canvas.addEventListener('wheel', handler, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handler)
    }
  }, [canvas, scrollZoom, model])

  if (!width) {
    return null
  }

  const {
    height,
    showCoverage,
    coverageHeight,
    pairedArcs,
    sashimiArcs,
    isChainMode,
    coverageDisplayHeight: topOffset,
    sashimiArcsHeight,
  } = model

  function handleCanvasMouseMove(e: React.MouseEvent) {
    processMouseMove(
      e,
      (hit, resolved) => {
        model.setFeatureIdUnderMouse(hit.id)
        if (isChainMode) {
          const chainIdx = resolved.rpcData.readChainIndices?.[hit.index]
          const chainIds =
            chainIdx !== undefined ? (model.chainIdMap.get(chainIdx) ?? []) : []
          model.setHighlightedChainIds(chainIds)
          model.setMouseoverExtraInformation(
            formatChainTooltip(resolved.rpcData, hit.index, resolved.refName),
          )
        } else {
          if (model.highlightedChainIds.length > 0) {
            model.setHighlightedChainIds([])
          }
          model.setMouseoverExtraInformation(
            formatFeatureTooltip(hit.id, id => model.getFeatureInfoById(id)),
          )
        }
      },
      () => {
        model.clearMouseoverState()
      },
    )
  }

  function handleClick(e: React.MouseEvent) {
    processClick(
      e,
      (hit, resolved) => {
        void model.selectFeatureById(hit.id)
        if (isChainMode) {
          const chainIdx = resolved.rpcData.readChainIndices?.[hit.index]
          const chainIds =
            chainIdx !== undefined ? (model.chainIdMap.get(chainIdx) ?? []) : []
          model.setSelectedChainIds(chainIds)
        }
      },
      () => {
        model.clearSelection()
      },
    )
  }

  return (
    <div>
      <div
        data-testid={
          model.canvasDrawn ? 'pileup-display-done' : 'pileup-display'
        }
        style={{ position: 'relative', width: '100%', height }}
      >
        <PileupCanvas
          model={model}
          canvasRef={canvasRef}
          width={width}
          height={height}
          handleMouseDown={handleMouseDown}
          handleCanvasMouseMove={handleCanvasMouseMove}
          handleMouseLeave={handleMouseLeave}
          handleClick={handleClick}
          handleContextMenu={handleContextMenu}
        />

        <SashimiArcsOverlay model={model} />
        <PileupArcsOverlay model={model} />

        <VisibleLabelsHost
          model={model}
          width={width}
          height={height}
          contrastMap={contrastMap}
        />

        <CoverageAxisHost model={model} />

        <InsertSizeAxisHost model={model} />

        <LegendHost model={model} />

        {showCoverage ? (
          <ResizeHandle
            className={classes.resizeHandle}
            style={{ top: coverageHeight - YSCALEBAR_LABEL_OFFSET }}
            onDrag={dy => {
              model.setCoverageHeight(Math.max(20, model.coverageHeight + dy))
              return undefined
            }}
            title="Drag to resize coverage track"
          />
        ) : null}

        {pairedArcs === 'down' ? (
          <ResizeHandle
            className={classes.resizeHandle}
            style={{ top: topOffset - YSCALEBAR_LABEL_OFFSET }}
            onDrag={dy => {
              model.setArcsHeight(Math.max(20, model.arcsHeight + dy))
              return undefined
            }}
            title="Drag to resize arcs area"
          />
        ) : null}

        {sashimiArcs === 'down' && showCoverage ? (
          <ResizeHandle
            className={classes.resizeHandle}
            style={{
              top: coverageHeight + sashimiArcsHeight - YSCALEBAR_LABEL_OFFSET,
            }}
            onDrag={dy => {
              model.setSashimiArcsHeight(
                Math.max(20, model.sashimiArcsHeight + dy),
              )
              return undefined
            }}
            title="Drag to resize sashimi arcs area"
          />
        ) : null}

        <PileupScrollbar model={model} topOffset={topOffset} />
      </div>
    </div>
  )
})

const PileupCanvas = observer(function PileupCanvas({
  model,
  canvasRef,
  width,
  height,
  handleMouseDown,
  handleCanvasMouseMove,
  handleMouseLeave,
  handleClick,
  handleContextMenu,
}: {
  model: LinearAlignmentsDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  width: number
  height: number
  handleMouseDown: (e: React.MouseEvent) => void
  handleCanvasMouseMove: (e: React.MouseEvent) => void
  handleMouseLeave: () => void
  handleClick: (e: React.MouseEvent) => void
  handleContextMenu: (e: React.MouseEvent) => void
}) {
  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width,
        height,
        cursor:
          model.featureIdUnderMouse || model.overCigarItem
            ? 'pointer'
            : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  )
})

const VisibleLabelsHost = observer(function VisibleLabelsHost({
  model,
  width,
  height,
  contrastMap,
}: {
  model: LinearAlignmentsDisplayModel
  width: number
  height: number
  contrastMap: Record<string, string>
}) {
  return (
    <VisibleLabelsOverlay
      labels={model.visibleLabels}
      width={width}
      height={height}
      contrastMap={contrastMap}
    />
  )
})

const CoverageAxisHost = observer(function CoverageAxisHost({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { coverageTicks } = model
  if (!coverageTicks) {
    return null
  }
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: model.scalebarOverlapLeft,
        pointerEvents: 'none',
        height: model.coverageHeight,
        width: 50,
      }}
    >
      <g transform="translate(45, 0)">
        <YScaleBar ticks={model.coverageTicks} orientation="left" />
      </g>
    </svg>
  )
})

const InsertSizeAxisHost = observer(function InsertSizeAxisHost({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { insertSizeTicks, pairedArcs } = model
  if (!insertSizeTicks) {
    return null
  }
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        pointerEvents: 'none',
        height: model.height,
        width: 50,
      }}
    >
      <YScaleBar ticks={insertSizeTicks} orientation="right" />
      {pairedArcs === 'samplot' ? (
        <TlenAxisLabel
          yTop={insertSizeTicks.yTop}
          yBottom={insertSizeTicks.yBottom}
        />
      ) : null}
    </svg>
  )
})

const LegendHost = observer(function LegendHost({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  if (!model.showLegend) {
    return null
  }
  return <FloatingLegend items={model.legendItems} />
})

const PileupScrollbar = observer(function PileupScrollbar({
  model,
  topOffset,
}: {
  model: LinearAlignmentsDisplayModel
  topOffset: number
}) {
  const { classes } = useStyles()
  const { scrollableHeight, pileupViewportHeight, totalPileupHeight } = model
  const dragAcRef = useAbortableRef()
  if (scrollableHeight <= 0) {
    return null
  }
  const trackHeight = pileupViewportHeight
  const thumbHeight = Math.max(
    20,
    trackHeight * (trackHeight / totalPileupHeight),
  )
  const thumbTop =
    (model.currentRangeY[0] / scrollableHeight) * (trackHeight - thumbHeight)
  return (
    <div
      className={classes.scrollbarTrack}
      style={{ top: topOffset, height: trackHeight }}
      onMouseDown={e => {
        const startScroll = model.currentRangeY[0]
        const scrollRange = model.scrollableHeight
        const usableTrack = trackHeight - thumbHeight
        startDocumentDrag(e, dragAcRef, (_dx, dy) => {
          const scrollDelta =
            usableTrack > 0 ? (dy / usableTrack) * scrollRange : 0
          const next = clamp(startScroll + scrollDelta, 0, scrollRange)
          model.setCurrentRangeY([next, next + model.pileupViewportHeight])
        })
      }}
    >
      <div
        className={classes.scrollbarThumb}
        style={{ top: thumbTop, height: thumbHeight }}
      />
    </div>
  )
})

export default PileupComponent
