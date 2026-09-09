import React, { useCallback, useEffect, useId, useState } from 'react'

import { ScrollChrome } from '@jbrowse/core/ui'
import { VERTICAL_SCROLLBAR_CLEARANCE } from '@jbrowse/core/ui/VerticalScrollbar'
import { useCoalescedPointer } from '@jbrowse/core/ui/useCoalescedPointer'
import { capitalizeFirst } from '@jbrowse/core/util'
import { eventPoint } from '@jbrowse/core/util/eventPoint'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useEventCallback } from '@jbrowse/core/util/useEventCallback'
import { usePanelVirtualScroll } from '@jbrowse/core/util/usePanelVirtualScroll'
import BottomRightIndicators from '@jbrowse/display-kit/BottomRightIndicators'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { DisplayContextMenu } from '@jbrowse/display-kit/DisplayContextMenu'
import TrackHeightIndicator from '@jbrowse/display-kit/TrackHeightIndicator'
import { PointerLayer } from '@jbrowse/display-ui'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import { ScrollLockedOverlay } from '@jbrowse/render-core/ScrollLockedOverlay'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import DensityBandOverlay from '../../shared/DensityBandOverlay.tsx'
import { CANVAS_FEATURE_MARKS } from '../marks/canvasFeatureMarks.ts'
import { MORPH_DURATION_MS, morphClockMs } from '../yMorph.ts'
import FeatureTooltip from './FeatureTooltip.tsx'
import GeneGlyphControl from './GeneGlyphControl.tsx'
import SoloSelectionChip from './SoloSelectionChip.tsx'
import { performMultiRegionHitDetection } from './hitTesting.ts'
import {
  hgvsHitLabel,
  hoverTooltipRows,
  hoverTooltipText,
} from './hoverReadout.ts'
import { FloatingLabelsLayer, HighlightLayer } from './overlayElements.tsx'

import type { LinearCanvasBaseDisplayModel } from '../baseModel.ts'
import type { HitFeatureResult } from './hitTesting.ts'

function createCanvasFeatureBackend(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, CANVAS_FEATURE_MARKS)
}

export interface LinearBasicDisplayComponentProps {
  model: LinearCanvasBaseDisplayModel
}

const useStyles = makeStyles()({
  root: {
    position: 'relative',
    width: '100%',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    // Selectable text over the canvas shows an I-beam, and a drag there hijacks
    // the mouseover.
    userSelect: 'none',
  },
  // One element covering the canvas and its overlays, so the wheel gesture has
  // something to bind to: a clickable floating label is the canvas's sibling, and
  // a wheel over it never reaches a listener on the canvas.
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  // Scroll is virtual — a scrollbar overlay and a wheel handler drive
  // model.scrollTop — so the canvas never moves and the overlays take their Y
  // from the same value, with no compositor scroll to tear against.
  canvas: {
    display: 'block',
    position: 'absolute',
    top: 0,
    left: 0,
  },
})

// Its own observer, so the notice hook's reads re-render this chip rather than
// the whole body.
const GeneGlyphIndicator = observer(function GeneGlyphIndicator({
  model,
}: LinearBasicDisplayComponentProps) {
  const notice = model.geneGlyphNotice
  return notice ? (
    <GeneGlyphControl
      collapsed={notice.collapsed}
      maxIsoforms={notice.maxIsoforms}
      picks={notice.picks}
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

// Its own observer, so a scroll frame re-renders this wrapper alone; the layer
// children arrive as stable elements and do not re-run.
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

// Chrome belonging to one subclass arrives through a model hook rather than a
// prop: the variant display shares this body and has no `geneGlyphMode` slot to
// answer with.
const FeatureComponent = observer(function FeatureComponent({
  model,
}: LinearBasicDisplayComponentProps) {
  const { classes } = useStyles()
  return (
    <DisplayChrome
      model={model}
      factory={createCanvasFeatureBackend}
      testid="feature-display"
      className={classes.root}
      style={{ height: model.height }}
    >
      {({ canvasRef, mouseTracker }) => (
        <>
          <FeatureBody model={model} canvasRef={canvasRef} />
          {/* `mouseoverExtraInformation` decides whether there is a tooltip at
              all; only the position comes from the chrome's tracker. */}
          <PointerLayer mouseTracker={mouseTracker}>
            {mouseState => (
              <FeatureTooltip
                rows={model.mouseoverExtraInformation}
                mouseState={mouseState}
              />
            )}
          </PointerLayer>
        </>
      )}
    </DisplayChrome>
  )
})

const FeatureBody = observer(function FeatureBody({
  model,
  canvasRef,
}: LinearBasicDisplayComponentProps & {
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const { classes } = useStyles()
  const canvasId = useId()
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)

  const view = containingLgv(model)

  // Gated on `initialized` because `canvasWidthPx` reaches `view.width`, which
  // throws before the view is measured.
  const width = view.initialized ? model.canvasWidthPx : undefined
  const height = model.height

  // Bound to the panel wrapper rather than the canvas, so a wheel over a floating
  // label — clickable, so it answers the pointer itself — is still the panel's.
  usePanelVirtualScroll(panel, model, {
    viewportHeight: model.height,
    scrollZoom: view.scrollZoom,
  })

  // The model decides when to morph; the frame loop that advances it lives here
  // because it is a DOM-side effect.
  useEffect(() => {
    // The frame handle doubles as "a frame is already pending" — rAF handles are
    // never 0 — so one morph cannot schedule the loop twice.
    let raf = 0
    const tick = () => {
      raf = 0
      if (!isAlive(model) || model.morphFromTops === undefined) {
        return
      }
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
      // This clock alone advances morphProgress, so a morph left in flight would
      // freeze renderDataMap partway and hold `maxY` at the taller layout for as
      // long as the display lives.
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
      // model.scrollTop, not the live DOM scrollTop: the canvas paints at this
      // value and the DOM-to-model sync lags a frame mid-scroll.
      canvasY + model.scrollTop,
    )

  const hitTestAtEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = eventPoint(e)
    return hitTestAt(x, y)
  }

  // `mousemove` outruns the frame, and every raw event walks the Flatbush indexes
  // and builds fresh tooltip strings. Coalescing is safe because the two gestures
  // that decide anything re-hit-test from their own event.
  const hover = useCoalescedPointer(([canvasX, canvasY]: [number, number]) => {
    if (!isAlive(model)) {
      return
    }
    model.setDensityHoverPx(canvasX)
    const result = hitTestAt(canvasX, canvasY)
    if (result) {
      model.setHover(
        result.feature.featureId,
        result.subfeature?.featureId,
        hoverTooltipRows(result),
      )
    } else {
      model.clearHover()
    }
  })

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Read the coordinates now: `currentTarget` is gone by the frame.
    const { x, y } = eventPoint(e)
    hover.queue([x, y])
  }

  // Both handlers hit-test at the event coordinates rather than reading
  // model.hoveredFeature: opening a context menu drops the hover and its backdrop
  // holds the pointer, so a click on a stationary cursor right after dismissing
  // one would find no hover at all.
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const result = hitTestAtEvent(e)
    // Ctrl/Cmd+click builds the show-only collection instead of opening the
    // details, so several features can be tagged while all are visible and then
    // isolated together.
    if ((e.ctrlKey || e.metaKey) && result) {
      model.toggleSoloFeature(result.feature.featureId)
    } else if (result) {
      model.selectFeatureById(
        result.feature.featureId,
        result.subfeature,
        result.displayedRegionIndex,
      )
    } else {
      model.clearSelection()
    }
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const result = hitTestAtEvent(e)
    if (result) {
      e.preventDefault()
      // A hover frame queued before the click would land after openContextMenu's
      // clearHover and rewrite the hover the menu was opened over.
      hover.cancel()
      model.openContextMenu({
        item: result.feature,
        displayedRegionIndex: result.displayedRegionIndex,
        clientX: e.clientX,
        clientY: e.clientY,
        subfeature: result.subfeature,
        // Both resolved here rather than in the menu: only the hit knows which
        // base was clicked and at what zoom.
        hgvsLabel: hgvsHitLabel(result),
        tooltipText: hoverTooltipText(result),
      })
    }
  }

  // Stable identity, so a hover tick re-rendering FeatureBody for the cursor style
  // does not make the label layer rebuild every label. The cancel comes first: a
  // hover queued just before the pointer left would re-light what this clears.
  const handleMouseLeave = useEventCallback(() => {
    hover.cancel()
    model.clearHover()
    model.setDensityHoverPx(undefined)
  })

  // The layer hands over a hit shaped like the canvas path's, so crossing from a
  // feature onto its name keeps the isoform, exon and HGVS rows.
  const onLabelMouseOver = useCallback(
    (hit: HitFeatureResult) => {
      model.setHover(hit.feature.featureId, undefined, hoverTooltipRows(hit))
    },
    [model],
  )

  return (
    <>
      <div ref={setPanel} className={classes.panel}>
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

        {/* Outside the scrolled overlay layer: the band replaces the features
            entirely, so nothing under it scrolls. */}
        <DensityBandOverlay model={model} />

        <OverlayScrollLayer model={model}>
          <HighlightLayer model={model} view={view} />
          <FloatingLabelsLayer
            model={model}
            view={view}
            onLabelMouseOver={onLabelMouseOver}
            onLabelMouseLeave={handleMouseLeave}
          />
        </OverlayScrollLayer>
      </div>

      {/* scrollContentHeight, not contentHeight: these report where a scroll can
          go, and the drawing height also covers fetch-buffer rows no scroll
          reaches. */}
      <ScrollChrome
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
          fitNote={model.fitNote}
          onSetHeightMode={mode => {
            model.setHeightMode(mode)
          }}
        />
      </BottomRightIndicators>

      <DisplayContextMenu model={model} />
    </>
  )
})

export default FeatureComponent
