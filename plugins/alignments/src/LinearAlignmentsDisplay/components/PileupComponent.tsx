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

const SCROLLBAR_WIDTH = 12
const COMPACT_AXIS_HEIGHT = 30
// left-orientation g translates by AXIS_SVG_WIDTH - YSCALEBAR_LABEL_OFFSET
const AXIS_SVG_WIDTH = 50

const useStyles = makeStyles()(theme => ({
  scrollbarTrack: {
    position: 'absolute' as const,
    right: 0,
    width: SCROLLBAR_WIDTH,
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
  compactAxisLabel: {
    position: 'absolute' as const,
    right: SCROLLBAR_WIDTH + 2,
    fontSize: 9,
    lineHeight: '11px',
    fontFamily: 'sans-serif',
    color: theme.palette.text.secondary,
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
  },
}))

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

  const { height, belowCoverageBands: bands } = model
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
        if (model.isChainMode) {
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
        if (model.isChainMode) {
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

      <CoverageResizeHandle model={model} />

      <ConnectionBandResizeHandles model={model} />

      <GroupResizeHandles model={model} />

      <PileupScrollbar model={model} topOffset={topOffset} />
    </div>
  )
})

const CoverageResizeHandle = observer(function CoverageResizeHandle({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
  if (!model.showCoverage) {
    return null
  }
  return (
    <ResizeHandle
      className={classes.resizeHandle}
      style={{ top: model.coverageHeight - YSCALEBAR_LABEL_OFFSET }}
      onDrag={dy => {
        model.setCoverageHeight(Math.max(20, model.coverageHeight + dy))
        return undefined
      }}
      title="Drag to resize coverage track"
    />
  )
})

// Arc + sashimi band resize handles. The heights are display-global, so a
// single handle (at the first section's band bottom) resizes every section's
// band. Ungrouped keeps them sticky; grouped scrolls them with the first
// section and hides them once that band scrolls off-screen. The first section
// starts at content-y 0, so its band bottoms equal `belowCoverageBands`.
const ConnectionBandResizeHandles = observer(
  function ConnectionBandResizeHandles({
    model,
  }: {
    model: LinearAlignmentsDisplayModel
  }) {
    const { classes } = useStyles()
    const { belowCoverageBands: bands, isGrouped, scrollTop, height } = model
    const scroll = isGrouped ? scrollTop : 0
    const arcHandleTop = bands.sashimiBandTop - YSCALEBAR_LABEL_OFFSET - scroll
    const sashimiHandleTop = bands.bottom - YSCALEBAR_LABEL_OFFSET - scroll
    const onScreen = (top: number) =>
      top >= -YSCALEBAR_LABEL_OFFSET && top <= height
    return (
      <>
        {bands.hasArcsBand && onScreen(arcHandleTop) ? (
          <ResizeHandle
            className={classes.resizeHandle}
            style={{ top: arcHandleTop }}
            onDrag={dy => {
              model.setReadConnectionsHeight(
                Math.max(20, model.readConnectionsHeight + dy),
              )
              return undefined
            }}
            title="Drag to resize arcs area"
          />
        ) : null}

        {bands.hasSashimiBand && onScreen(sashimiHandleTop) ? (
          <ResizeHandle
            className={classes.resizeHandle}
            style={{ top: sashimiHandleTop }}
            onDrag={dy => {
              model.setSashimiArcsHeight(
                Math.max(20, model.sashimiArcsHeight + dy),
              )
              return undefined
            }}
            title="Drag to resize sashimi arcs area"
          />
        ) : null}
      </>
    )
  },
)

// Per-group pileup-height drag handles (in-track grouping only). Each sits at a
// non-collapsed section's pileup bottom and resizes just that group's band, so
// a dense section can be shrunk without touching the others.
const GroupResizeHandles = observer(function GroupResizeHandles({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
  if (!model.isGrouped) {
    return null
  }
  const { scrollTop, height } = model
  return (
    <>
      {model.renderSections.map(section => {
        if (model.isGroupCollapsed(section.groupKey)) {
          return null
        }
        const bottom = section.topOffset + section.pileupHeight - scrollTop
        if (bottom < 0 || bottom > height) {
          return null
        }
        return (
          <ResizeHandle
            key={section.groupKey || 'ungrouped'}
            className={classes.resizeHandle}
            style={{ top: bottom - YSCALEBAR_LABEL_OFFSET }}
            onDrag={dy => {
              model.resizeGroupHeight(section.groupKey, dy)
              return undefined
            }}
            title={`Drag to resize "${section.label || 'group'}"`}
          />
        )
      })}
    </>
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

function CompactCoverageLabel({ top, max }: { top: number; max: number }) {
  const { classes } = useStyles()
  return (
    <div className={classes.compactAxisLabel} style={{ top }}>
      {`[0, ${Math.round(max)}]`}
    </div>
  )
}

// One bar on the right for the topmost visible section. Right side avoids the
// group labels at left:4. All groups share coverageTicks so one bar suffices.
const GroupedCoverageAxis = observer(function GroupedCoverageAxis({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { coverageTicks, scrollTop, height, renderSections } = model
  const section = renderSections.find(s => {
    const top = s.coverageTop - scrollTop
    return top + s.coverageHeight >= 0 && top <= height
  })
  if (!section || !coverageTicks) {
    return null
  }
  const top = section.coverageTop - scrollTop
  if (section.coverageHeight < COMPACT_AXIS_HEIGHT) {
    return (
      <CompactCoverageLabel
        top={top + 1}
        max={coverageTicks.items.at(-1)?.value ?? 0}
      />
    )
  }
  return (
    <svg
      style={{
        position: 'absolute',
        top,
        right: SCROLLBAR_WIDTH + 2,
        pointerEvents: 'none',
        height: section.coverageHeight,
        width: AXIS_SVG_WIDTH,
      }}
    >
      <YScaleBar ticks={coverageTicks} orientation="right" />
    </svg>
  )
})

const UngroupedCoverageAxis = observer(function UngroupedCoverageAxis({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { coverageTicks, renderSections, scalebarOverlapLeft } = model
  const section = renderSections[0]
  if (!coverageTicks || !section) {
    return null
  }
  if (section.coverageHeight < COMPACT_AXIS_HEIGHT) {
    return (
      <CompactCoverageLabel
        top={1}
        max={coverageTicks.items.at(-1)?.value ?? 0}
      />
    )
  }
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: scalebarOverlapLeft,
        pointerEvents: 'none',
        height: section.coverageHeight,
        width: AXIS_SVG_WIDTH,
      }}
    >
      <g transform={`translate(${AXIS_SVG_WIDTH - YSCALEBAR_LABEL_OFFSET}, 0)`}>
        <YScaleBar ticks={coverageTicks} orientation="left" />
      </g>
    </svg>
  )
})

// Split so scroll-dependent tracking (GroupedCoverageAxis) is isolated —
// UngroupedCoverageAxis won't re-render on scroll.
const CoverageAxisHost = observer(function CoverageAxisHost({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  return model.isGrouped ? (
    <GroupedCoverageAxis model={model} />
  ) : (
    <UngroupedCoverageAxis model={model} />
  )
})

// Only rendered in samplot mode (insertSizeTicks is null otherwise). Shared
// Y-domain means one bar is value-correct for all sections; in grouped mode
// it scrolls with the first section.
const InsertSizeAxisHost = observer(function InsertSizeAxisHost({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { insertSizeTicks, readConnectionsDown, isGrouped, scrollTop, height } =
    model
  if (!insertSizeTicks) {
    return null
  }
  const yShift = isGrouped ? -scrollTop : 0
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        ...(readConnectionsDown ? { left: 0 } : { right: 0 }),
        pointerEvents: 'none',
        height,
        width: AXIS_SVG_WIDTH,
      }}
    >
      <g transform={`translate(0, ${yShift})`}>
        {readConnectionsDown ? (
          <g transform={`translate(${AXIS_SVG_WIDTH - YSCALEBAR_LABEL_OFFSET}, 0)`}>
            <YScaleBar ticks={insertSizeTicks} orientation="left" />
          </g>
        ) : (
          <YScaleBar ticks={insertSizeTicks} orientation="right" />
        )}
        <TlenAxisLabel
          yTop={insertSizeTicks.yTop}
          yBottom={insertSizeTicks.yBottom}
          x={readConnectionsDown ? 6 : undefined}
        />
      </g>
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
  const {
    scrollableHeight,
    pileupViewportHeight: trackHeight,
    pileupContentHeight,
  } = model
  const dragAcRef = useAbortableRef()
  if (scrollableHeight <= 0) {
    return null
  }
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
        const scrollRange = scrollableHeight
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
