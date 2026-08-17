import { Fragment, useId } from 'react'

import {
  ResizeHandle,
  ScrollEdgeShadow,
  VerticalScrollbar,
} from '@jbrowse/core/ui'
import { VERTICAL_SCROLLBAR_CLEARANCE } from '@jbrowse/core/ui/VerticalScrollbar'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { usePanelVirtualScroll } from '@jbrowse/core/util/usePanelVirtualScroll'
import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { YScaleBar } from '@jbrowse/wiggle-core'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { observer } from 'mobx-react'

import {
  LEGEND_MAX_WIDTH,
  getAlignmentsLegendSections,
} from '../../shared/legendUtils.ts'
import {
  AXIS_SVG_WIDTH,
  COMPACT_AXIS_HEIGHT,
  compactAxisLabel,
  leftAxisSpineX,
} from '../coverageAxisStyle.ts'
import ArcDebugOverlay from './ArcDebugOverlay.tsx'
import ArcHoverOverlay from './ArcHoverOverlay.tsx'
import CrossRegionArcsOverlay from './CrossRegionArcsOverlay.tsx'
import GroupLabelsOverlay from './GroupLabelsOverlay.tsx'
import HighlightOverlay from './HighlightOverlay.tsx'
import { InsertSizeAxisStack } from './InsertSizeAxis.tsx'
import PileupBezierOverlay from './PileupBezierOverlay.tsx'
import PileupTruncationRule from './PileupTruncationRule.tsx'
import SashimiArcsOverlay from './SashimiArcsOverlay.tsx'
import VisibleLabelsOverlay from './VisibleLabelsOverlay.tsx'
import {
  bandOnScreen,
  bandScreenTop,
  contentScreenY,
  sectionKey,
  tickSpanOnScreen,
} from './sectionScreen.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'
import type React from 'react'

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
    right: VERTICAL_SCROLLBAR_CLEARANCE,
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
    handleCanvasMouseMove,
    handleClick,
  } = useAlignmentsBase(model)

  const view = getContainingView(model) as { scrollZoom?: boolean }
  const { scrollZoom } = view
  const canvasId = useId()

  // The pileup's viewport is its own, not the track's: ungrouped, the coverage
  // band above it is sticky and doesn't scroll.
  usePanelVirtualScroll(canvas, model, {
    viewportHeight: model.pileupViewportHeight,
    scrollZoom: !!scrollZoom,
  })

  if (!width) {
    return null
  }

  const { height, belowCoverageBands: bands } = model
  // The scrollbar track starts below the sticky coverage (ungrouped) or spans
  // the whole display (grouped, where the entire stack scrolls).
  const topOffset = model.isGrouped ? 0 : bands.bottom

  return (
    <div
      // No testid: `pileup-display[-done]` is DisplayChrome's now, on the same
      // element as `data-display-phase`. This div stays for its layout role (it
      // sizes the pileup below the sticky coverage band), not as a query target.
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
      <PileupTruncationRule model={model} />

      <SashimiArcsOverlay model={model} />
      <CrossRegionArcsOverlay model={model} />
      <PileupBezierOverlay model={model} />
      <ArcHoverOverlay model={model} />
      <ArcDebugOverlay model={model} />

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

      {/* the pileup's own viewport, so in ungrouped mode it starts below the
          pinned coverage band rather than fading the band itself */}
      <ScrollEdgeShadow
        scrollTop={model.scrollTop}
        viewportHeight={model.pileupViewportHeight}
        contentHeight={model.pileupContentHeight}
        top={topOffset}
      />

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
            key={sectionKey(section.groupKey)}
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

// Arc + sashimi band resize handles, one per group. The heights are
// display-global, so every handle resizes all sections' bands together; each
// still gets an affordance at its own band bottom (arc band ends at the sashimi
// band top; the sashimi band ends at the pileup top), scrolling with its
// section and culled off-screen. Ungrouped is the single sticky section.
//
// Both handles are gated per section (`hasArcsBand` / `hasSashimiBand`), not on
// the global geometry: a lane that reserves no strip has none to resize, and its
// handle would land on the pixel of the handle above it.
const ConnectionBandResizeHandles = observer(
  function ConnectionBandResizeHandles({
    model,
  }: {
    model: LinearAlignmentsDisplayModel
  }) {
    const { height, scrollModel: scroll } = model
    return (
      <>
        {model.renderSections.map(section => {
          return (
            <Fragment key={sectionKey(section.groupKey)}>
              {section.hasArcsBand ? (
                <PileupResizeHandle
                  top={bandScreenTop(
                    section.sashimiBandTop - YSCALEBAR_LABEL_OFFSET,
                    scroll,
                  )}
                  canvasHeight={height}
                  onDrag={dy => {
                    model.setReadConnectionsHeight(
                      model.readConnectionsHeight + dy,
                    )
                  }}
                  title="Drag to resize arcs area"
                />
              ) : null}

              {section.hasSashimiBand ? (
                <PileupResizeHandle
                  top={bandScreenTop(
                    section.topOffset - YSCALEBAR_LABEL_OFFSET,
                    scroll,
                  )}
                  canvasHeight={height}
                  onDrag={dy => {
                    model.setSashimiArcsHeight(model.sashimiArcsHeight + dy)
                  }}
                  title="Drag to resize sashimi arcs area"
                />
              ) : null}
            </Fragment>
          )
        })}
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
  // `canSizeGroupHeights` is the shared gate with the label chip's expand
  // button — both write `groupMaxHeightOverrides`, so neither is offered where
  // the other is hidden. Only stacked lanes get a drag: one section's pileup
  // bottom is the display's own bottom edge, which the track height owns.
  if (!model.isGrouped || !model.canSizeGroupHeights) {
    return null
  }
  const { height, scrollModel: scroll } = model
  return (
    <>
      {model.renderSections.map(section => {
        if (section.collapsed) {
          return null
        }
        const bottom = contentScreenY(
          section.topOffset + section.pileupHeight,
          scroll,
        )
        return (
          <PileupResizeHandle
            key={sectionKey(section.groupKey)}
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

function CompactCoverageLabel({
  top,
  ticks,
}: {
  top: number
  ticks: NonNullable<LinearAlignmentsDisplayModel['coverageTicks']>
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.compactAxisLabel} style={{ top }}>
      {compactAxisLabel(ticks)}
    </div>
  )
}

// One coverage y-axis bar, on the right at a section's scrolled band top. Right
// side avoids the group labels at left:4. All groups share `coverageTicks` (one
// domain), so each band shows the same scale positioned at its own coverage.
function GroupCoverageAxisBar({
  top,
  coverageHeight,
  ticks,
}: {
  top: number
  coverageHeight: number
  ticks: NonNullable<LinearAlignmentsDisplayModel['coverageTicks']>
}) {
  if (coverageHeight < COMPACT_AXIS_HEIGHT) {
    return <CompactCoverageLabel top={top + 1} ticks={ticks} />
  }
  return (
    <svg
      style={{
        position: 'absolute',
        top,
        right: VERTICAL_SCROLLBAR_CLEARANCE,
        pointerEvents: 'none',
        height: coverageHeight,
        width: AXIS_SVG_WIDTH,
      }}
    >
      <YScaleBar ticks={ticks} orientation="right" />
    </svg>
  )
}

// One bar per group so every coverage band carries its own scale; each scrolls
// with its section and off-screen bands are culled.
const GroupedCoverageAxis = observer(function GroupedCoverageAxis({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { coverageTicks, renderSections, scrollModel: scroll } = model
  if (!coverageTicks) {
    return null
  }
  return (
    <>
      {renderSections.map(section => {
        const top = bandScreenTop(section.coverageTop, scroll)
        return bandOnScreen(top, section.coverageHeight, scroll) ? (
          <GroupCoverageAxisBar
            key={sectionKey(section.groupKey)}
            top={top}
            coverageHeight={section.coverageHeight}
            ticks={coverageTicks}
          />
        ) : null
      })}
    </>
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
    return <CompactCoverageLabel top={1} ticks={coverageTicks} />
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
      {/* the same spine placement the export uses, so the two can't drift */}
      <g transform={`translate(${leftAxisSpineX(0)}, 0)`}>
        <YScaleBar ticks={coverageTicks} orientation="left" />
      </g>
    </svg>
  )
})

// Split so scroll-dependent tracking (GroupedCoverageAxis) is isolated —
// UngroupedCoverageAxis won't re-render on scroll.
//
// `showsGroupLabels`, NOT `isGrouped`: the right-hand axis exists to clear the
// group label chips (see coverageAxisStyle.ts), so the question is whether the
// chips are drawn, not whether there is more than one section. A grouping that
// yields a single named section draws them — and `scalebarOverlapLeft` is 0
// there, so the left axis landed straight on top of the chip. GroupedCoverageAxis
// projects through `bandScreenTop`, which keeps that lone section's band sticky.
const CoverageAxisHost = observer(function CoverageAxisHost({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  return model.showsGroupLabels ? (
    <GroupedCoverageAxis model={model} />
  ) : (
    <UngroupedCoverageAxis model={model} />
  )
})

// Only rendered in read-cloud mode (`insertSizeTickSections` is empty
// otherwise). One bar per section that reserves an arc band, mirroring
// `CoverageAxisHost`: the Y domain is pooled across groups so every bar reads
// the same values, but the bands are stacked, and a single bar could only sit
// beside the first of them.
const InsertSizeAxisHost = observer(function InsertSizeAxisHost({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const {
    insertSizeTickSections,
    readConnectionsDown,
    height,
    scrollModel: scroll,
  } = model
  if (insertSizeTickSections.length === 0) {
    return null
  }
  // Cull the off-screen bands, the same duty `GroupedCoverageAxis` does above:
  // a grouped read cloud scrolls its sections, so most of them are outside the
  // canvas on any frame and their ticks are reconciliation spent on ink the
  // `<svg>` root clips anyway.
  //
  // Here and not inside `InsertSizeAxisStack`, because the stack is shared with
  // `renderSvg` and an export has no viewport to be off-screen of — every band
  // must reach the figure.
  const visible = insertSizeTickSections.filter(({ ticks }) =>
    tickSpanOnScreen(ticks, scroll),
  )
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        // the box `InsertSizeAxis` lays itself out in; the export anchors the
        // same one with `insertSizeAxisBoxLeft`
        ...(readConnectionsDown ? { left: 0 } : { right: 0 }),
        pointerEvents: 'none',
        height,
        width: AXIS_SVG_WIDTH,
      }}
    >
      <InsertSizeAxisStack
        sections={visible}
        down={readConnectionsDown}
        // The arc band is a sticky-capable band top like coverage — same tier,
        // same projection, rather than a second inline
        // `isGrouped ? -scrollTop : 0`.
        yShift={bandScreenTop(0, model.scrollModel)}
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
  const onDismiss = () => {
    model.setShowLegend(false)
  }
  return (
    <FloatingLegend
      sections={getAlignmentsLegendSections(model)}
      onDismiss={onDismiss}
      // wider than the 200 default: the split-read rows have to name which kind
      // of read they classify ("Split paired-end read (same strand)"), which is
      // this display's longest label and the only one that overflows. Sized to
      // it, not padded — see LEGEND_MAX_WIDTH.
      maxWidth={LEGEND_MAX_WIDTH}
    />
  )
})

export default PileupBody
