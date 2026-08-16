import React, { useCallback, useEffect, useId } from 'react'

import {
  ContextMenu,
  ScrollEdgeShadow,
  VerticalScrollbar,
  useMouseState,
} from '@jbrowse/core/ui'
import { VERTICAL_SCROLLBAR_CLEARANCE } from '@jbrowse/core/ui/VerticalScrollbar'
import { useCoalescedPointer } from '@jbrowse/core/ui/useCoalescedPointer'
import { capitalizeFirst, getContainingView } from '@jbrowse/core/util'
import { eventPoint } from '@jbrowse/core/util/eventPoint'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useEventCallback } from '@jbrowse/core/util/useEventCallback'
import { usePanelVirtualScroll } from '@jbrowse/core/util/usePanelVirtualScroll'
import { isAlive } from '@jbrowse/mobx-state-tree'
import {
  BottomRightIndicators,
  DisplayChrome,
  FloatingLegend,
  TrackHeightIndicator,
} from '@jbrowse/plugin-linear-genome-view'
import { ScrollLockedOverlay } from '@jbrowse/render-core/ScrollLockedOverlay'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { MORPH_DURATION_MS, morphClockMs } from '../yMorph.ts'
import { CanvasFeatureRenderer } from './CanvasFeatureRenderer.ts'
import FeatureTooltip from './FeatureTooltip.tsx'
import GeneGlyphControl from './GeneGlyphControl.tsx'
import SoloSelectionChip from './SoloSelectionChip.tsx'
import { isHitFeature, performMultiRegionHitDetection } from './hitTesting.ts'
import {
  hgvsHitLabel,
  hoverTooltipRows,
  hoverTooltipText,
} from './hoverReadout.ts'
import { FloatingLabelsLayer, HighlightLayer } from './overlayElements.tsx'

import type { FlatbushItem } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearCanvasBaseDisplayModel } from '../baseModel.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// The model type is the real MST instance (`LinearCanvasBaseDisplayModel`): the
// display registers this component from index.ts, so nothing imports it back into
// the model and there's no cycle to work around. It used to be a hand-mirrored
// 92-field structural interface plus a separate compile-time contract file
// guarding it.
export interface LinearBasicDisplayComponentProps {
  model: LinearCanvasBaseDisplayModel
}

const useStyles = makeStyles()({
  root: {
    position: 'relative',
    width: '100%',
    // inherited from `DisplayContainer` until it was deleted; kept verbatim so
    // the label overlays below still lay out the same way
    whiteSpace: 'nowrap',
    textAlign: 'left',
    // no text cursor / drag-selection over the canvas and its label overlays —
    // selectable text there shows an I-beam and a drag hijacks the mouseover
    userSelect: 'none',
  },
  // Fixed viewport canvas: the GPU paints the visible window at
  // `inst.y - scrollY` (scrollY = model.scrollTop). Scroll is virtual (a
  // VerticalScrollbar overlay + wheel handler drive model.scrollTop), so the
  // canvas never moves and the overlays derive their Y from the same scrollTop
  // — no native overflow container, no compositor/main-thread scroll tearing.
  canvas: {
    display: 'block',
    position: 'absolute',
    top: 0,
    left: 0,
  },
})

// The isoform-collapse chip, driven by the `geneGlyphNotice` hook. Its own
// observer so the hook's reads (which include the loaded data's
// hasMultiIsoformGenes) re-render just this chip rather than the whole body.
const GeneGlyphIndicator = observer(function GeneGlyphIndicator({
  model,
}: LinearBasicDisplayComponentProps) {
  const notice = model.geneGlyphNotice
  return notice ? (
    <GeneGlyphControl
      collapsed={notice.collapsed}
      maxIsoforms={notice.maxIsoforms}
      dismissed={notice.dismissed}
      geneGlyphMode={notice.mode}
      onSetGeneGlyphMode={value => {
        notice.setMode(value)
      }}
      onDismiss={() => {
        notice.dismiss()
      }}
    />
  ) : null
})

// Wraps the overlays in the shared ScrollLockedOverlay so labels/highlights
// track the GPU canvas's model.scrollTop rather than the native compositor
// scroll (see ScrollLockedOverlay for why). Its own observer so only this thin
// wrapper re-renders per scroll frame; the layer children are passed as stable
// elements and don't re-run.
const OverlayScrollLayer = observer(function OverlayScrollLayer({
  model,
  children,
}: {
  model: LinearCanvasBaseDisplayModel
  children: React.ReactNode
}) {
  return (
    <ScrollLockedOverlay
      scrollTop={model.scrollTop}
      viewportHeight={model.height}
      contentHeight={model.contentHeight}
    >
      {children}
    </ScrollLockedOverlay>
  )
})

// The canvas body shared by every canvas-family display (features, variants).
// Thin outer owns the DisplayChrome; FeatureBody owns the scroll container,
// hit-testing, and the canvas itself; FloatingLabelsLayer and HighlightLayer
// (separate observers) own the label / peptide and hover / selection layers.
//
// Chrome that belongs to one subclass arrives through a model hook, not a prop:
// the isoform control below reads `model.geneGlyphNotice`, which the canvas base
// declares as absent by default (the variant display shares this body and has no
// `geneGlyphMode` slot to answer with).
const FeatureComponent = observer(function FeatureComponent({
  model,
}: LinearBasicDisplayComponentProps) {
  const { classes } = useStyles()
  return (
    <DisplayChrome
      model={model}
      factory={CanvasFeatureRenderer}
      testid="feature-display"
      className={classes.root}
      style={{ height: model.height }}
    >
      {({ canvasRef, canvas, mouseTracker }) => (
        <>
          <FeatureBody model={model} canvasRef={canvasRef} canvas={canvas} />
          {/* Inside the chrome, which is the `position:relative` box it pins
              itself to. It used to sit in `DisplayContainer` one level up —
              also relative, so the geometry is unchanged. */}
          <ColorLegendOverlay model={model} />
          {/* Its own component, and a sibling of the body rather than a child
              of it, so that following the pointer re-renders the tooltip alone.
              This was a `clientXY` useState inside `FeatureBody`, written from
              the canvas's own `onMouseMove`, which re-rendered the body and
              every overlay under it on each raw (uncoalesced) move while a
              feature was hovered. See `useMouseTracking`. maf was the last
              other one and is converted too, so no display holds a pointer
              position in React state now. */}
          <FeatureTooltipLayer model={model} mouseTracker={mouseTracker} />
        </>
      )}
    </DisplayChrome>
  )
})

// `mouseoverExtraInformation` is what decides whether there is a tooltip at
// all — the hit test that sets it runs on the canvas's own handlers, from the
// event's own coordinates, because the click and right-click paths share it
// (coalesced to a frame for the hover alone; see `hover` below). Only the
// *position* comes from the chrome's tracker, and client coordinates are
// viewport-relative, so it makes no difference which element measured them.
const FeatureTooltipLayer = observer(function FeatureTooltipLayer({
  model,
  mouseTracker,
}: {
  model: LinearCanvasBaseDisplayModel
  mouseTracker: MouseTracker
}) {
  const mouseState = useMouseState(mouseTracker)
  return (
    <FeatureTooltip
      rows={model.mouseoverExtraInformation}
      mouseState={mouseState}
    />
  )
})

const FeatureBody = observer(function FeatureBody({
  model,
  canvasRef,
  canvas,
}: LinearBasicDisplayComponentProps & {
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
}) {
  const { classes } = useStyles()
  const canvasId = useId()

  const view = getContainingView(model) as LGV

  // `canvasWidthPx` off the model, gated on `initialized` because it reaches
  // `view.width`, which throws before the view is measured. Never a second
  // `view.trackWidthPx` read — see `MultiRegionDisplayMixin.canvasWidthPx`.
  const width = view.initialized ? model.canvasWidthPx : undefined
  const height = model.height

  // model.openContextMenu (a stable MST action) is passed straight to the
  // overlays and called from handleContextMenu — no wrapper needed. It sets
  // contextMenuInfo synchronously (featureId/startBp/endBp/type + click
  // position); each item that needs the full feature re-fetches on click, so
  // the menu opens immediately without an RPC round-trip.

  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startRenderingBackend / stopRenderingBackend / renderNow on the base
  // canvas display model. scrollTop lives on the model (TrackHeightMixin) and
  // feeds `renderState.scrollY`. Virtual scroll: the wheel gesture writes
  // model.scrollTop directly (no native overflow container), so the GPU canvas
  // and the DOM overlays both key off it. The rule is the pileup's, shared as
  // `usePanelVirtualScroll`; the whole track height is the viewport, this
  // display having no sticky band above its features.
  usePanelVirtualScroll(canvas, model, {
    viewportHeight: model.height,
    scrollZoom: view.scrollZoom,
  })

  // rAF clock for the feature-Y transition. The model decides when to morph
  // (sets morphFromTops); this advances morphProgress 0->1 over
  // MORPH_DURATION_MS, which re-derives renderDataMap each frame, then settles.
  // Kept in the component because the frame loop is inherently a DOM-side effect.
  useEffect(() => {
    // The frame handle doubles as "a frame is already pending" below — rAF
    // handles are never 0 — so the loop can't schedule itself twice off one
    // morph.
    let raf = 0
    const tick = () => {
      raf = 0
      if (!isAlive(model) || model.morphFromTops === undefined) {
        return
      }
      // morphClockMs, the same clock beginYMorph stamped morphStartMs from.
      const t = Math.min(
        1,
        (morphClockMs() - model.morphStartMs) / MORPH_DURATION_MS,
      )
      model.setMorphProgress(t)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        model.endYMorph()
      }
    }
    const dispose = autorun(() => {
      if (model.morphFromTops !== undefined && raf === 0) {
        raf = requestAnimationFrame(tick)
      }
    })
    return () => {
      dispose()
      cancelAnimationFrame(raf)
      // This clock is the only thing that advances morphProgress, so a morph
      // left in flight here would never finish: renderDataMap would stay frozen
      // partway through the interpolation and `maxY` would hold at the taller of
      // the two layouts for as long as the display lives. Settle it instead —
      // the destination layout is already correct, only the animation is lost.
      if (isAlive(model)) {
        model.endYMorph()
      }
    }
  }, [model])

  const hitTestAt = (canvasX: number, canvasY: number) =>
    performMultiRegionHitDetection(
      model.laidOutDataMap,
      model.flatbushIndexes,
      view.visibleRegions,
      canvasX,
      // model.scrollTop, not the live DOM scrollTop: the canvas paints at
      // model.scrollTop (renderState.scrollY) and the DOM->model sync lags one
      // frame, so hit-testing the DOM value can miss by a frame mid-scroll
      canvasY + model.scrollTop,
    )

  const hitTestAtEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = eventPoint(e)
    return hitTestAt(x, y)
  }

  // Hover, resolved at most once per frame. `mousemove` outruns the frame, and
  // every raw event here walked the Flatbush indexes and built a fresh row of
  // tooltip strings; `setHover` drops the write when the rows match, but the
  // work ahead of it was paid either way.
  //
  // Safe for the same reason it is in the pileup: the two gestures that decide
  // anything re-hit-test from their own event (see below), so a hover landing a
  // frame later than the cursor is invisible.
  const hover = useCoalescedPointer(([canvasX, canvasY]: [number, number]) => {
    if (!isAlive(model)) {
      return
    }
    const result = hitTestAt(canvasX, canvasY)
    if (isHitFeature(result)) {
      model.setHover(
        result.feature.featureId,
        result.subfeature?.featureId ?? null,
        hoverTooltipRows(result),
      )
    } else {
      model.clearHover()
    }
  })

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // The early return skips the hit test as well as the write, which is the
    // half `setHover`'s own open-menu guard cannot do.
    if (model.contextMenuInfo) {
      return
    }
    // read the coordinates now; `currentTarget` is gone by the frame
    const { x, y } = eventPoint(e)
    hover.queue([x, y])
  }

  // Both handlers hit-test at the event coordinates rather than reading
  // model.hoveredFeature. Hover is suppressed while a context menu is open (see
  // handleMouseMove) and cleared when it closes (closeContextMenu), so a
  // click/right-click on a still-stationary cursor right after dismissing a
  // menu would otherwise find no hover — deselecting, or falling through to the
  // native browser menu — instead of acting on the feature under the cursor.
  // When hover is current these resolve to the identical feature.
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const result = hitTestAtEvent(e)
    // Ctrl/Cmd+click builds the "show only these features" collection instead
    // of opening the feature details, so several features can be tagged while
    // they're all still visible, then isolated together via the context menu.
    if ((e.ctrlKey || e.metaKey) && isHitFeature(result)) {
      model.toggleSoloFeature(result.feature.featureId)
    } else if (isHitFeature(result)) {
      model.selectFeatureById(
        result.feature.featureId,
        result.subfeature ?? undefined,
        result.displayedRegionIndex,
      )
    } else {
      model.clearSelection()
    }
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const result = hitTestAtEvent(e)
    if (isHitFeature(result)) {
      // openContextMenu pins the hover box to what the menu acts on. The
      // subfeature rides along so the menu can target the exact transcript
      // under the cursor, not just its gene.
      e.preventDefault()
      model.openContextMenu({
        item: result.feature,
        displayedRegionIndex: result.displayedRegionIndex,
        clientX: e.clientX,
        clientY: e.clientY,
        subfeature: result.subfeature ?? undefined,
        // resolved here rather than in the menu: only the hit knows which base
        // was clicked and at what zoom
        hgvsLabel: hgvsHitLabel(result),
        // same reasoning — the plain-text form of the tooltip this exact hit
        // would show, for the "Copy tooltip text" menu item
        tooltipText: hoverTooltipText(result),
      })
    }
  }

  // Shared by the canvas and the label layer (see FloatingLabelsLayer): whichever
  // of the two the cursor was last over, exiting it drops the hover. Stable
  // identity so a hover tick — which re-renders FeatureBody for the cursor
  // style — doesn't force the label layer to rebuild every label. clearHover
  // itself holds the open-menu pin, so no guard here.
  //
  // The cancel comes first: a hover queued just before the pointer left lands
  // after it has gone and re-lights what this is clearing.
  const handleMouseLeave = useEventCallback(() => {
    hover.cancel()
    model.clearHover()
  })

  // setHover itself is inert while a context menu is open (it pins the hover to
  // the menu's target), so this needs no guard of its own — unlike
  // handleMouseMove, whose early return also skips the hit test.
  const onLabelMouseOver = useCallback(
    (item: FlatbushItem) => {
      model.setHover(item.featureId, null, [item.tooltip])
    },
    [model],
  )

  return (
    <>
      <canvas
        id={canvasId}
        role="img"
        aria-label={`${capitalizeFirst(model.featureNoun)} track`}
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={e => {
          handleClick(e)
        }}
        onContextMenu={handleContextMenu}
        className={classes.canvas}
        style={{
          width,
          height,
          cursor: model.hoveredFeature ? 'pointer' : 'default',
        }}
      />

      <OverlayScrollLayer model={model}>
        <HighlightLayer model={model} view={view} />
        <FloatingLabelsLayer
          model={model}
          view={view}
          onLabelMouseOver={onLabelMouseOver}
          onLabelMouseLeave={handleMouseLeave}
        />
      </OverlayScrollLayer>

      {/* after the overlay layer, so a label clipped at the bottom edge fades
          with the features it names; before the scrollbar, whose z-index keeps
          the thumb crisp over it either way */}
      {/* both from scrollContentHeight, not contentHeight: they report where a
          scroll can go, and the drawing height also covers the fetch buffer's
          rows, which no scroll reaches */}
      <ScrollEdgeShadow
        scrollTop={model.scrollTop}
        viewportHeight={model.height}
        contentHeight={model.scrollContentHeight}
      />

      <VerticalScrollbar
        scrollTop={model.scrollTop}
        setScrollTop={n => {
          model.setScrollTop(n)
        }}
        viewportHeight={model.height}
        contentHeight={model.scrollContentHeight}
        controlsId={canvasId}
      />

      <BottomRightIndicators
        scrollbarWidth={model.hasOverflow ? VERTICAL_SCROLLBAR_CLEARANCE : 0}
      >
        <SoloSelectionChip
          count={model.soloFeatureCount}
          applied={model.soloApplied}
          featureNoun={model.featureNoun}
          onApply={() => {
            model.applySolo()
          }}
          onClear={() => {
            model.clearSolo()
          }}
        />
        <GeneGlyphIndicator model={model} />
        <TrackHeightIndicator
          heightMode={model.heightMode}
          hasOverflow={model.hasOverflow}
          scrollZoom={view.scrollZoom}
          noun={model.featureNoun}
          truncatedCount={model.truncatedFeatureCount}
          onSetHeightMode={mode => {
            model.setHeightMode(mode)
          }}
        />
      </BottomRightIndicators>

      <ContextMenu
        anchor={model.contextMenuInfo}
        menuItems={() => model.contextMenuItems()}
        onClose={() => {
          model.closeContextMenu()
        }}
      />
    </>
  )
})

// Its own observer so a coloring change repaints the key alone, not the body.
const ColorLegendOverlay = observer(function ColorLegendOverlay({
  model,
}: LinearBasicDisplayComponentProps) {
  const legend = model.colorLegend
  // The hook is present whenever a key exists; `dismissed` is what decides
  // whether it draws, so the track menu's "Show legend" checkbox can still see a
  // key the user has put away. See CanvasColorLegend.
  return legend && !legend.dismissed ? (
    <FloatingLegend
      items={legend.items}
      onDismiss={() => {
        legend.setDismissed(true)
      }}
    />
  ) : null
})

export default FeatureComponent
