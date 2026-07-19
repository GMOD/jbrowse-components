import React, { useCallback, useEffect, useId, useState } from 'react'

import { Menu, VerticalScrollbar } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useVirtualScrollWheel } from '@jbrowse/core/util/useVirtualScrollWheel'
import { isAlive } from '@jbrowse/mobx-state-tree'
import {
  DisplayChrome,
  TrackHeightIndicator,
} from '@jbrowse/plugin-linear-genome-view'
import { ScrollLockedOverlay } from '@jbrowse/render-core/ScrollLockedOverlay'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import BottomRightIndicators from './BottomRightIndicators.tsx'
import { CanvasFeatureRenderer } from './CanvasFeatureRenderer.ts'
import FeatureTooltip from './FeatureTooltip.tsx'
import GeneGlyphControl from './GeneGlyphControl.tsx'
import PeptideCanvas from './PeptideCanvas.tsx'
import SoloSelectionChip from './SoloSelectionChip.tsx'
import {
  hoverTooltip,
  isHitFeature,
  performMultiRegionHitDetection,
} from './hitTesting.ts'
import {
  useFloatingLabels,
  useHighlightOverlays,
} from './useOverlayElements.tsx'
import { MORPH_DURATION_MS } from '../yMorph.ts'

import type { CanvasFeatureRenderingBackend } from './canvasFeatureRenderingBackendTypes.ts'
import type { GeneGlyphMode } from '../geneGlyphMode.ts'
import type { FeatureItemEntry, FlatbushRegionIndexes } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type {
  HeightMode,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

type LGV = LinearGenomeViewModel

// Hand-rolled structural type, NOT `Instance<typeof stateModelFactory>`. The
// MST factory references this component via `lazy()`, so importing the real
// model type back into the component creates a circular type reference that
// breaks inference across the whole file. The compile-time check in
// LinearBasicDisplay/modelContract.ts catches drift: when the real MST model
// renames or drops a field, the contract file fails to typecheck.
export interface LinearBasicDisplayModel {
  height: number
  laidOutDataMap: Map<number, FeatureDataResult>
  renderDataMap: Map<number, FeatureDataResult>
  morphFromTops: Map<string, number> | undefined
  morphStartMs: number
  setMorphProgress: (t: number) => void
  endYMorph: () => void
  featureItemMap: Map<string, FeatureItemEntry>
  displayPhase: DisplayPhase
  error: unknown
  maxY: number
  hasOverflow: boolean
  contentHeight: number
  scrollableHeight: number
  heightMode: HeightMode
  setHeightMode: (mode: HeightMode) => void
  selectedFeatureId: string | undefined
  highlightedFeatureIdSet: ReadonlySet<string>
  featureIdUnderMouse: string | null
  subfeatureIdUnderMouse: string | null
  hoveredFeature: FlatbushItem | null
  hoveredSubfeature: SubfeatureInfo | null
  flatbushIndexes: ReadonlyMap<number, FlatbushRegionIndexes>
  scrollTop: number
  effectiveShowDescriptions: boolean
  renderedShowDescriptions: boolean
  renderedShowLabels: boolean
  displayMode: string
  labelFontSize: number
  labelScrollBucket: number
  regionTooLarge: boolean
  regionTooLargeReason: string
  showGeneGlyphNotice: boolean
  geneGlyphCollapsed: boolean
  geneGlyphNoticeDismissed: boolean
  geneGlyphMode: GeneGlyphMode
  setGeneGlyphMode: (value: GeneGlyphMode) => void
  dismissGeneGlyphNotice: () => void
  statusMessage: string | undefined
  setScrollTop: (n: number) => void
  forceLoad: () => void
  reload: () => void
  clearHover: () => void
  mouseoverExtraInformation: string | undefined
  setHover: (
    featureId: string | null,
    subfeatureId: string | null,
    tooltip: string | undefined,
  ) => void
  selectFeatureById: (
    featureId: string,
    subfeatureInfo: SubfeatureInfo | undefined,
    displayedRegionIndex: number,
  ) => void
  toggleSoloFeature: (featureId: string) => void
  soloFeatureIdSet: ReadonlySet<string>
  soloApplied: boolean
  applySolo: () => void
  clearSolo: () => void
  openContextMenu: (
    featureInfo: FlatbushItem,
    displayedRegionIndex: number,
    clientX: number,
    clientY: number,
    subfeature?: SubfeatureInfo,
  ) => void
  contextMenuInfo:
    | {
        item: FlatbushItem
        subfeature?: SubfeatureInfo
        displayedRegionIndex: number
        clientX: number
        clientY: number
      }
    | undefined
  closeContextMenu: () => void
  fetchFullFeature: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
  contextMenuItems: () => MenuItem[]
  getFeatureById: (featureId: string) => FlatbushItem | undefined
  clearSelection: () => void
  startRenderingBackend: (backend: CanvasFeatureRenderingBackend) => void
  stopRenderingBackend: () => void
  renderNow: () => void
  renderError: unknown
  setRenderError: (error: unknown) => void
  canvasDrawn: boolean
}

export interface Props {
  model: LinearBasicDisplayModel
}

const useStyles = makeStyles()({
  root: {
    position: 'relative',
    width: '100%',
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
})

function OverlayLayer({ children }: { children: React.ReactNode }) {
  const { classes } = useStyles()
  return children ? <div className={classes.overlay}>{children}</div> : null
}

const ContextMenu = observer(function ContextMenu({
  model,
}: {
  model: LinearBasicDisplayModel
}) {
  const info = model.contextMenuInfo
  const items = info ? model.contextMenuItems() : []
  // Mount only while open (no `?? 0` anchor fallback, never fades out an empty
  // Paper), and let closeContextMenu unmount it — same shape as
  // LinearAlignmentsDisplay. closeAfterItemClick (Menu default) already closes
  // before the item callback, so onMenuItemClick just runs it.
  return info && items.length > 0 ? (
    <Menu
      open
      onMenuItemClick={callback => {
        callback()
      }}
      onClose={() => {
        model.closeContextMenu()
      }}
      anchorReference="anchorPosition"
      anchorPosition={{ top: info.clientY, left: info.clientX }}
      menuItems={items}
    />
  ) : null
})

// Floating labels + the peptide canvas derive purely from the laid-out rows and
// view geometry — never from the cursor or hover state. Its own observer so a
// mouse move (which only mutates the hover/selection observables read by
// HighlightLayer) never re-runs the per-feature label build. Labels follow the
// animated rows (renderDataMap) so they move with the glyphs during a layout
// transition; FeatureBody's hit-testing reads the destination layout
// (laidOutDataMap) so hover targets the final positions.
const FloatingLabelsLayer = observer(function FloatingLabelsLayer({
  model,
  view,
  openContextMenu,
  onLabelMouseOver,
  onLabelMouseLeave,
}: {
  model: LinearBasicDisplayModel
  view: LGV
  openContextMenu: (
    feature: FlatbushItem,
    displayedRegionIndex: number,
    clientX: number,
    clientY: number,
  ) => void
  onLabelMouseOver: (
    item: FlatbushItem,
    displayedRegionIndex: number,
    e: React.MouseEvent,
  ) => void
  onLabelMouseLeave: () => void
}) {
  const renderDataMap = model.renderDataMap
  const width = view.initialized ? view.trackWidthPx : undefined
  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions

  const floatingLabelElements = useFloatingLabels(
    renderDataMap,
    model.featureItemMap,
    visibleRegions,
    view.initialized,
    width,
    bpPerPx,
    model,
    openContextMenu,
    onLabelMouseOver,
    onLabelMouseLeave,
  )

  return (
    <>
      {floatingLabelElements}
      <PeptideCanvas
        renderDataMap={renderDataMap}
        visibleRegions={visibleRegions}
        viewInitialized={view.initialized}
        width={width}
        height={model.contentHeight}
        bpPerPx={bpPerPx}
      />
    </>
  )
})

// Hover / selection / solo / search highlight boxes. Split out from the labels
// because useHighlightOverlays reads hoveredFeature/hoveredSubfeature, which
// change on every mouse move — keeping it in its own observer means a hover tick
// re-renders just these few boxes, not the whole floating-label build.
const HighlightLayer = observer(function HighlightLayer({
  model,
  view,
}: {
  model: LinearBasicDisplayModel
  view: LGV
}) {
  const width = view.initialized ? view.trackWidthPx : undefined
  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions

  const highlightOverlays = useHighlightOverlays(
    model.featureItemMap,
    visibleRegions,
    view.initialized,
    width,
    bpPerPx,
    model,
  )

  return <OverlayLayer>{highlightOverlays}</OverlayLayer>
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
  model: LinearBasicDisplayModel
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

// Thin outer owns the DisplayChrome; FeatureBody owns the scroll container,
// hit-testing, and the canvas itself; FloatingLabelsLayer and HighlightLayer
// (separate observers) own the label / peptide and hover / selection layers.
const FeatureComponent = observer(function FeatureComponent({ model }: Props) {
  const { classes } = useStyles()
  return (
    <DisplayChrome
      model={model}
      factory={CanvasFeatureRenderer}
      className={classes.root}
      style={{ height: model.height }}
    >
      {({ canvasRef, canvas }) => (
        <FeatureBody model={model} canvasRef={canvasRef} canvas={canvas} />
      )}
    </DisplayChrome>
  )
})

const FeatureBody = observer(function FeatureBody({
  model,
  canvasRef,
  canvas,
}: Props & {
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
}) {
  // false positive: omitting <[number,number]> widens to number[] — known tuple issue
  // https://github.com/typescript-eslint/typescript-eslint/issues/9529
  const [clientXY, setClientXY] = useState<[number, number]>([0, 0])
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
    setClientXY([e.clientX, e.clientY])
    const result = hitTestAtEvent(e)
    if (result.feature) {
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
      model.openContextMenu(
        result.feature,
        result.displayedRegionIndex,
        e.clientX,
        e.clientY,
        result.subfeature ?? undefined,
      )
    }
  }

  // Shared by the canvas and the label layer (see useFloatingLabels): whichever
  // of the two the cursor was last over, exiting it drops the hover. Stable
  // identity so a hover tick — which re-renders FeatureBody for the cursor
  // style — doesn't force the label layer to rebuild every label.
  const handleMouseLeave = useCallback(() => {
    if (!model.contextMenuInfo) {
      model.clearHover()
    }
  }, [model])

  // setHover itself is inert while a context menu is open (it pins the hover to
  // the menu's target), so this needs no guard of its own — unlike
  // handleMouseMove, whose early return also skips the hit test.
  const onLabelMouseOver = useCallback(
    (item: FlatbushItem, _displayedRegionIndex: number, e: React.MouseEvent) => {
      setClientXY([e.clientX, e.clientY])
      model.setHover(item.featureId, null, item.tooltip)
    },
    [model],
  )

  return (
    <>
      <canvas
        id={canvasId}
        role="img"
        aria-label="Feature track"
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
          openContextMenu={model.openContextMenu}
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

      <BottomRightIndicators hasOverflow={model.hasOverflow}>
        <SoloSelectionChip
          count={model.soloFeatureIdSet.size}
          applied={model.soloApplied}
          onApply={() => {
            model.applySolo()
          }}
          onClear={() => {
            model.clearSolo()
          }}
        />
        <GeneGlyphControl
          visible={model.showGeneGlyphNotice}
          collapsed={model.geneGlyphCollapsed}
          dismissed={model.geneGlyphNoticeDismissed}
          geneGlyphMode={model.geneGlyphMode}
          onSetGeneGlyphMode={value => {
            model.setGeneGlyphMode(value)
          }}
          onDismiss={() => {
            model.dismissGeneGlyphNotice()
          }}
        />
        <TrackHeightIndicator
          heightMode={model.heightMode}
          hasOverflow={model.hasOverflow}
          scrollZoom={view.scrollZoom}
          noun="feature"
          onSetHeightMode={mode => {
            model.setHeightMode(mode)
          }}
        />
      </BottomRightIndicators>

      <FeatureTooltip
        info={model.mouseoverExtraInformation}
        clientMouseCoord={clientXY}
      />
      <ContextMenu model={model} />
    </>
  )
})

export default FeatureComponent
