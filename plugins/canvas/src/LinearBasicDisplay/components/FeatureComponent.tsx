import React, { useCallback, useEffect, useId } from 'react'

import { ContextMenu, VerticalScrollbar, useMouseState } from '@jbrowse/core/ui'
import { VERTICAL_SCROLLBAR_WIDTH } from '@jbrowse/core/ui/VerticalScrollbar'
import { capitalizeFirst, getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useVirtualScrollWheel } from '@jbrowse/core/util/useVirtualScrollWheel'
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

import { MORPH_DURATION_MS } from '../yMorph.ts'
import { CanvasFeatureRenderer } from './CanvasFeatureRenderer.ts'
import FeatureTooltip from './FeatureTooltip.tsx'
import GeneGlyphControl from './GeneGlyphControl.tsx'
import SoloSelectionChip from './SoloSelectionChip.tsx'
import { isHitFeature, performMultiRegionHitDetection } from './hitTesting.ts'
import { hgvsHitLabel, hoverTooltip, hoverTooltipText } from './hoverReadout.ts'
import { FloatingLabelsLayer, HighlightLayer } from './overlayElements.tsx'

import type { FlatbushItem } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearCanvasBaseDisplayModel } from '../baseModel.ts'
import type { MouseTracker } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// Right-edge width the VerticalScrollbar overlay claims while the content
// overflows, so the bottom-right indicators don't render underneath it. A shade
// wider than the scrollbar's own track, which keeps a hairline between them.
const SCROLLBAR_WIDTH = VERTICAL_SCROLLBAR_WIDTH + 2

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
// all — the hit test that sets it runs on the canvas's own handlers, at raw
// event coordinates, because the click and right-click paths share it. Only the
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
      info={model.mouseoverExtraInformation}
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

  const width = view.initialized ? view.trackWidthPx : undefined
  const height = model.height

  // model.openContextMenu (a stable MST action) is passed straight to the
  // overlays and called from handleContextMenu — no wrapper needed. It sets
  // contextMenuInfo synchronously (featureId/startBp/endBp/type + click
  // position); each item that needs the full feature re-fetches on click, so
  // the menu opens immediately without an RPC round-trip.

  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startRenderingBackend / stopRenderingBackend / renderNow on the base
  // canvas display model. scrollTop lives on the model (TrackHeightMixin) and
  // feeds `renderState.scrollY`. Virtual scroll: this wheel handler writes
  // model.scrollTop directly (no native overflow container), so the GPU canvas
  // and the DOM overlays both key off it. Mirrors the alignments pileup gesture:
  // under scrollZoom a plain wheel zooms the view (return, let it bubble) while
  // shift+wheel still scrolls the rows; the latch (inside applyScroll) owns
  // preventDefault but never stopPropagation, so a diagonal wheel still bubbles
  // its horizontal component to the LGV for panning.
  useVirtualScrollWheel(canvas, (e, applyScroll) => {
    if ((view.scrollZoom && !e.shiftKey) || e.ctrlKey || e.metaKey) {
      return
    }
    applyScroll(
      e,
      {
        scrollTop: model.scrollTop,
        viewportHeight: model.height,
        scrollableHeight: model.scrollableHeight,
      },
      n => {
        model.setScrollTop(n)
      },
    )
  })

  // rAF clock for the feature-Y transition. The model decides when to morph
  // (sets morphFromTops); this advances morphProgress 0->1 over
  // MORPH_DURATION_MS, which re-derives renderDataMap each frame, then settles.
  // Kept in the component because the frame loop is inherently a DOM-side effect.
  useEffect(() => {
    let raf = 0
    let running = false
    const tick = () => {
      if (!isAlive(model) || model.morphFromTops === undefined) {
        running = false
        return
      }
      const t = Math.min(
        1,
        (performance.now() - model.morphStartMs) / MORPH_DURATION_MS,
      )
      model.setMorphProgress(t)
      if (t < 1) {
        raf = requestAnimationFrame(() => {
          tick()
        })
      } else {
        model.endYMorph()
        running = false
      }
    }
    const dispose = autorun(() => {
      if (model.morphFromTops !== undefined && !running) {
        running = true
        raf = requestAnimationFrame(() => {
          tick()
        })
      }
    })
    return () => {
      dispose()
      cancelAnimationFrame(raf)
    }
  }, [model])

  const hitTestAtEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    // model.scrollTop, not the live DOM scrollTop: the canvas paints at
    // model.scrollTop (renderState.scrollY) and the DOM->model sync lags one
    // frame, so hit-testing the DOM value can miss by a frame mid-scroll
    const yPos = mouseY + model.scrollTop
    return performMultiRegionHitDetection(
      model.laidOutDataMap,
      model.flatbushIndexes,
      view.visibleRegions,
      mouseX,
      yPos,
    )
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (model.contextMenuInfo) {
      return
    }
    const result = hitTestAtEvent(e)
    if (isHitFeature(result)) {
      model.setHover(
        result.feature.featureId,
        result.subfeature?.featureId ?? null,
        hoverTooltip(result),
      )
    } else {
      model.clearHover()
    }
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
  const handleMouseLeave = useCallback(() => {
    model.clearHover()
  }, [model])

  // setHover itself is inert while a context menu is open (it pins the hover to
  // the menu's target), so this needs no guard of its own — unlike
  // handleMouseMove, whose early return also skips the hit test.
  const onLabelMouseOver = useCallback(
    (item: FlatbushItem) => {
      model.setHover(item.featureId, null, item.tooltip)
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

      <VerticalScrollbar
        scrollTop={model.scrollTop}
        setScrollTop={n => {
          model.setScrollTop(n)
        }}
        viewportHeight={model.height}
        contentHeight={model.contentHeight}
        controlsId={canvasId}
      />

      <BottomRightIndicators
        scrollbarWidth={model.hasOverflow ? SCROLLBAR_WIDTH : 0}
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
  return legend ? (
    <FloatingLegend
      items={legend.items}
      onDismiss={() => {
        legend.dismiss()
      }}
    />
  ) : null
})

export default FeatureComponent
