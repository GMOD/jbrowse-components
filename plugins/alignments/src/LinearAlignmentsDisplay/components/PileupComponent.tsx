import { useEffect, useMemo } from 'react'
import type React from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { ResizeHandle } from '@jbrowse/core/ui'
import {
  clamp,
  createScrollLatch,
  getContainingView,
  normalizeWheelDeltaY,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useEventCallback } from '@jbrowse/core/util/useEventCallback'
import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import GroupLabelsOverlay from './GroupLabelsOverlay.tsx'
import HighlightOverlay from './HighlightOverlay.tsx'
import PileupBezierOverlay from './PileupBezierOverlay.tsx'
import SashimiArcsOverlay from './SashimiArcsOverlay.tsx'
import TlenAxisLabel from './TlenAxisLabel.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import {
  startDocumentDrag,
  useAbortableRef,
} from './alignmentComponentUtils.ts'
import { formatChainTooltip, formatFeatureTooltip } from './tooltipUtils.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

import type {
  FeatureHit,
  LinearAlignmentsDisplayModel,
} from './useAlignmentsBase.ts'
import type { ResolvedBlock } from '../../shared/hitTestTypes.ts'

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

// The pileup canvas + all its positioned overlays. DisplayChrome owns the GPU
// backend and the three terminal states (render error, region-too-large, fetch
// error + loading), so this body renders only the success path — it receives
// the live `canvas`/`canvasRef` and never has to gate on them.
const PileupBody = observer(function PileupBody({
  model,
  canvasRef,
  canvas,
}: {
  model: LinearAlignmentsDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
}) {
  const {
    width,
    contrastMap,
    handleMouseDown,
    handleMouseLeave,
    handleContextMenu,
    processMouseMove,
    processClick,
  } = useAlignmentsBase(model, canvas)
  const { classes } = useStyles()

  const view = getContainingView(model) as { scrollZoom?: boolean }
  const { scrollZoom } = view
  const latch = useMemo(() => createScrollLatch(), [])

  const handleWheel = useEventCallback((e: WheelEvent) => {
    if ((scrollZoom && !e.shiftKey) || e.ctrlKey || e.metaKey) {
      return
    }
    const { scrollableHeight, pileupViewportHeight, scrollTop } = model
    if (scrollableHeight <= 0) {
      return
    }
    const dy = normalizeWheelDeltaY(e.deltaY, e.deltaMode, pileupViewportHeight)
    const next = latch.scroll(e, scrollTop, dy, scrollableHeight)
    if (next !== null) {
      model.setScrollTop(next)
    }
  })

  useEffect(() => {
    if (!canvas) {
      return
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [canvas, handleWheel])

  if (!width) {
    return null
  }

  const {
    height,
    showCoverage,
    coverageHeight,
    isChainMode,
    belowCoverageBands: bands,
  } = model
  // The scrollbar track starts below the sticky coverage (ungrouped) or spans
  // the whole display (grouped, where the entire stack scrolls).
  const topOffset = model.isGrouped ? 0 : bands.bottom

  function chainIdsForHit(hit: FeatureHit, resolved: ResolvedBlock) {
    const chainIdx = resolved.rpcData.readChainIndices?.[hit.index]
    return chainIdx !== undefined ? (model.chainIdMap.get(chainIdx) ?? []) : []
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    processMouseMove(
      e,
      (hit, resolved) => {
        model.setFeatureIdUnderMouse(hit.id)
        if (isChainMode) {
          model.setHighlightedChainIds(chainIdsForHit(hit, resolved))
          model.setMouseoverExtraInformation(
            formatChainTooltip(resolved.rpcData, hit.index, resolved.refName),
          )
        } else {
          model.clearHighlights()
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
          model.setSelectedChainIds(chainIdsForHit(hit, resolved))
        }
      },
      () => {
        model.clearSelection()
      },
    )
  }

  return (
    <div
      data-testid={model.canvasDrawn ? 'pileup-display-done' : 'pileup-display'}
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

      <HighlightOverlay model={model} />

      <GroupLabelsOverlay model={model} />

      <SashimiArcsOverlay model={model} />
      <PileupBezierOverlay model={model} />

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

      {!model.isGrouped && bands.hasArcsBand ? (
        <ResizeHandle
          className={classes.resizeHandle}
          style={{ top: bands.sashimiBandTop - YSCALEBAR_LABEL_OFFSET }}
          onDrag={dy => {
            model.setReadConnectionsHeight(
              Math.max(20, model.readConnectionsHeight + dy),
            )
            return undefined
          }}
          title="Drag to resize arcs area"
        />
      ) : null}

      {!model.isGrouped && bands.hasSashimiBand ? (
        <ResizeHandle
          className={classes.resizeHandle}
          style={{ top: bands.bottom - YSCALEBAR_LABEL_OFFSET }}
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
  // insertSizeTicks is only set in samplot mode. Down mode opens its band
  // below coverage, so the TLEN scalebar reads better on the left.
  const { insertSizeTicks, readConnectionsDown } = model
  if (!insertSizeTicks) {
    return null
  }
  return readConnectionsDown ? (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        height: model.height,
        width: 50,
      }}
    >
      <g transform="translate(45, 0)">
        <YScaleBar ticks={insertSizeTicks} orientation="left" />
      </g>
      <TlenAxisLabel
        yTop={insertSizeTicks.yTop}
        yBottom={insertSizeTicks.yBottom}
        x={6}
      />
    </svg>
  ) : (
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
      <TlenAxisLabel
        yTop={insertSizeTicks.yTop}
        yBottom={insertSizeTicks.yBottom}
      />
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
  return (
    <FloatingLegend
      items={model.legendItems()}
      onDismiss={() => {
        model.setShowLegend(false)
      }}
    />
  )
})

const PileupScrollbar = observer(function PileupScrollbar({
  model,
  topOffset,
}: {
  model: LinearAlignmentsDisplayModel
  topOffset: number
}) {
  const { classes } = useStyles()
  const { scrollableHeight, pileupViewportHeight, pileupContentHeight } = model
  const dragAcRef = useAbortableRef()
  if (scrollableHeight <= 0) {
    return null
  }
  const trackHeight = pileupViewportHeight
  const thumbHeight = Math.max(
    20,
    trackHeight * (trackHeight / pileupContentHeight),
  )
  const thumbTop =
    (model.scrollTop / scrollableHeight) * (trackHeight - thumbHeight)
  return (
    <div
      className={classes.scrollbarTrack}
      style={{ top: topOffset, height: trackHeight }}
      onMouseDown={e => {
        const startScroll = model.scrollTop
        const scrollRange = model.scrollableHeight
        const usableTrack = trackHeight - thumbHeight
        startDocumentDrag(e, dragAcRef, (_dx, dy) => {
          const scrollDelta =
            usableTrack > 0 ? (dy / usableTrack) * scrollRange : 0
          const next = clamp(startScroll + scrollDelta, 0, scrollRange)
          model.setScrollTop(next)
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

export default PileupBody
