import { useId } from 'react'
import type React from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { ResizeHandle, VerticalScrollbar } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useVirtualScrollWheel } from '@jbrowse/core/util/useVirtualScrollWheel'
import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import GroupLabelsOverlay from './GroupLabelsOverlay.tsx'
import HighlightOverlay from './HighlightOverlay.tsx'
import PileupBezierOverlay from './PileupBezierOverlay.tsx'
import SashimiArcsOverlay from './SashimiArcsOverlay.tsx'
import TlenAxisLabel from './TlenAxisLabel.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import { bandOnScreen, bandScreenTop, contentScreenY } from './sectionScreen.ts'
import { formatChainTooltip, formatFeatureTooltip } from './tooltipUtils.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

const SCROLLBAR_WIDTH = 12
const COMPACT_AXIS_HEIGHT = 30
// left-orientation g translates by AXIS_SVG_WIDTH - YSCALEBAR_LABEL_OFFSET
const AXIS_SVG_WIDTH = 50

const useStyles = makeStyles()(theme => ({
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
  } = useAlignmentsBase(model)

  const view = getContainingView(model) as { scrollZoom?: boolean }
  const { scrollZoom } = view
  const canvasId = useId()

  useVirtualScrollWheel(canvas, (e, applyScroll) => {
    if ((scrollZoom && !e.shiftKey) || e.ctrlKey || e.metaKey) {
      return
    }
    const next = applyScroll(e, {
      scrollTop: model.scrollTop,
      viewportHeight: model.pileupViewportHeight,
      scrollableHeight: model.scrollableHeight,
    })
    if (next !== null) {
      model.setScrollTop(next)
    }
  })

  if (!width) {
    return null
  }

  const { height, belowCoverageBands: bands } = model
  // The scrollbar track starts below the sticky coverage (ungrouped) or spans
  // the whole display (grouped, where the entire stack scrolls).
  const topOffset = model.isGrouped ? 0 : bands.bottom

  function handleCanvasMouseMove(e: React.MouseEvent) {
    processMouseMove(
      e,
      (hit, resolved) => {
        model.setFeatureIdUnderMouse(hit.id)
        if (model.isChainMode) {
          model.setHighlightedChainIds(
            model.chainIdsForRead(resolved.rpcData, hit.index),
          )
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
          model.setSelectedChainIds(
            model.chainIdsForRead(resolved.rpcData, hit.index),
          )
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
        canvasId={canvasId}
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

      <VerticalScrollbar
        scrollTop={model.scrollTop}
        setScrollTop={n => {
          model.setScrollTop(n)
        }}
        viewportHeight={model.pileupViewportHeight}
        contentHeight={model.pileupContentHeight}
        controlsId={canvasId}
        top={topOffset}
      />
    </div>
  )
})

// Shared horizontal drag handle for the pileup's resizable bands. Callers pass
// the final screen-space `top` and the canvas height; styling, the off-screen
// cull (every handle is YSCALEBAR_LABEL_OFFSET tall), and the void-returning
// `onDrag` contract are uniform across coverage, arc/sashimi, and group handles.
function PileupResizeHandle({
  top,
  canvasHeight,
  onDrag,
  title,
}: {
  top: number
  canvasHeight: number
  onDrag: (dy: number) => void
  title: string
}) {
  const { classes } = useStyles()
  if (top + YSCALEBAR_LABEL_OFFSET < 0 || top > canvasHeight) {
    return null
  }
  return (
    <ResizeHandle
      className={classes.resizeHandle}
      style={{ top }}
      onDrag={onDrag}
      title={title}
    />
  )
}

// Coverage-band resize handle at each section's coverage bottom. `coverageHeight`
// is display-global, so every handle resizes all bands together; grouped mode
// still gets one affordance per group (each section keeps its own coverage band,
// including collapsed groups), scrolling with its band. Ungrouped is the single
// sticky section, reproducing the prior lone handle at `coverageHeight`.
const CoverageResizeHandle = observer(function CoverageResizeHandle({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  if (!model.showCoverage) {
    return null
  }
  const { height, scrollModel: scroll } = model
  return (
    <>
      {model.renderSections.map(section => {
        const bottom = bandScreenTop(
          section.coverageTop + section.coverageHeight,
          scroll,
        )
        return (
          <PileupResizeHandle
            key={section.groupKey || 'ungrouped'}
            top={bottom - YSCALEBAR_LABEL_OFFSET}
            canvasHeight={height}
            onDrag={dy => {
              model.setCoverageHeight(model.coverageHeight + dy)
            }}
            title="Drag to resize coverage track"
          />
        )
      })}
    </>
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
    const { belowCoverageBands: bands, height, scrollModel: scroll } = model
    const arcHandleTop = bandScreenTop(
      bands.sashimiBandTop - YSCALEBAR_LABEL_OFFSET,
      scroll,
    )
    const sashimiHandleTop = bandScreenTop(
      bands.bottom - YSCALEBAR_LABEL_OFFSET,
      scroll,
    )
    return (
      <>
        {bands.hasArcsBand ? (
          <PileupResizeHandle
            top={arcHandleTop}
            canvasHeight={height}
            onDrag={dy => {
              model.setReadConnectionsHeight(model.readConnectionsHeight + dy)
            }}
            title="Drag to resize arcs area"
          />
        ) : null}

        {bands.hasSashimiBand ? (
          <PileupResizeHandle
            top={sashimiHandleTop}
            canvasHeight={height}
            onDrag={dy => {
              model.setSashimiArcsHeight(model.sashimiArcsHeight + dy)
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
  if (!model.isGrouped) {
    return null
  }
  const { height, scrollModel: scroll } = model
  return (
    <>
      {model.renderSections.map(section => {
        if (model.isGroupCollapsed(section.groupKey)) {
          return null
        }
        const bottom = contentScreenY(
          section.topOffset + section.pileupHeight,
          scroll,
        )
        return (
          <PileupResizeHandle
            key={section.groupKey || 'ungrouped'}
            top={bottom - YSCALEBAR_LABEL_OFFSET}
            canvasHeight={height}
            onDrag={dy => {
              model.resizeGroupHeight(section.groupKey, dy)
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
  canvasId,
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
  canvasId: string
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
      id={canvasId}
      role="img"
      aria-label="Sequence alignments pileup"
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
  const { coverageTicks, renderSections, scrollModel: scroll } = model
  const section = renderSections.find(s =>
    bandOnScreen(
      bandScreenTop(s.coverageTop, scroll),
      s.coverageHeight,
      scroll,
    ),
  )
  if (!section || !coverageTicks) {
    return null
  }
  const top = bandScreenTop(section.coverageTop, scroll)
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
          <g
            transform={`translate(${AXIS_SVG_WIDTH - YSCALEBAR_LABEL_OFFSET}, 0)`}
          >
            <YScaleBar ticks={insertSizeTicks} orientation="left" />
          </g>
        ) : (
          <YScaleBar ticks={insertSizeTicks} orientation="right" />
        )}
        <TlenAxisLabel
          yTop={insertSizeTicks.yTop}
          yBottom={insertSizeTicks.yBottom}
          x={readConnectionsDown ? 11 : undefined}
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

export default PileupBody
