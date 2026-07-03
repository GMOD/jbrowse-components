import React, { useCallback, useEffect, useId, useState } from 'react'

import { Menu, VerticalScrollbar } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useVirtualScrollWheel } from '@jbrowse/core/util/useVirtualScrollWheel'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { ScrollLockedOverlay } from '@jbrowse/render-core/ScrollLockedOverlay'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import BottomRightIndicators from './BottomRightIndicators.tsx'
import { CanvasFeatureRenderer } from './CanvasFeatureRenderer.ts'
import FeatureTooltip from './FeatureTooltip.tsx'
import IsoformCollapseNotice from './IsoformCollapseNotice.tsx'
import OverflowIndicator from './OverflowIndicator.tsx'
import PeptideCanvas from './PeptideCanvas.tsx'
import SoloSelectionChip from './SoloSelectionChip.tsx'
import { hoverTooltip, performMultiRegionHitDetection } from './hitTesting.ts'
import {
  useFloatingLabels,
  useHighlightOverlays,
} from './useOverlayElements.tsx'
import { MORPH_DURATION_MS } from '../yMorph.ts'

import type { CanvasFeatureRenderingBackend } from './canvasFeatureRenderingBackendTypes.ts'
import type { FeatureItemEntry, FlatbushRegionIndexes } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
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
  canExpand: boolean
  heightBeforeExpand: number | undefined
  autoHeight: boolean
  showLabels: boolean
  selectedFeatureId: string | undefined
  highlightedFeatureIds: string[]
  featureIdUnderMouse: string | null
  subfeatureIdUnderMouse: string | null
  hoveredRegionIndex: number | undefined
  hoveredFeature: FlatbushItem | null
  hoveredSubfeature: SubfeatureInfo | null
  flatbushIndexes: ReadonlyMap<number, FlatbushRegionIndexes>
  scrollTop: number
  effectiveShowDescriptions: boolean
  displayMode: string
  regionTooLarge: boolean
  regionTooLargeReason: string
  showIsoformCollapseNotice: boolean
  dismissIsoformCollapseNotice: () => void
  featureDensityStats?: { bytes?: number }
  statusMessage: string | undefined
  setScrollTop: (n: number) => void
  setFeatureDensityStatsLimit: (s?: {
    bytes?: number
    fetchSizeLimit?: number
  }) => void
  forceLoad: () => void
  reload: () => void
  expandToFit: () => void
  collapseFromExpand: () => void
  clearHover: () => void
  mouseoverExtraInformation: string | undefined
  setHover: (
    featureId: string | null,
    subfeatureId: string | null,
    tooltip: string | undefined,
    displayedRegionIndex: number,
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
  showContextMenuForFeature: (
    featureInfo: FlatbushItem,
    displayedRegionIndex: number,
    clientX: number,
    clientY: number,
  ) => void
  contextMenuInfo:
    | {
        item: FlatbushItem
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
  const onClose = () => {
    model.closeContextMenu()
  }
  return (
    <Menu
      open={!!info && items.length > 0}
      onMenuItemClick={callback => {
        callback()
        onClose()
      }}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{
        top: info?.clientY ?? 0,
        left: info?.clientX ?? 0,
      }}
      menuItems={items}
    />
  )
})

// Labels, highlights, and the peptide canvas derive purely from model/view
// observables — never from the cursor position. Isolating them in this memoized
// observer keeps FeatureBody's per-mousemove clientXY state (which only feeds
// the tooltip) from rebuilding every label and overlay div on each mouse move.
const Overlays = observer(function Overlays({
  model,
  view,
  openContextMenu,
  onLabelMouseOver,
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
}) {
  // Overlays follow the animated rows (renderDataMap) so they move with the
  // glyphs during a layout transition; FeatureBody's hit-testing reads the
  // destination layout (laidOutDataMap) so hover targets the final positions.
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
  )

  const highlightOverlays = useHighlightOverlays(
    model.featureItemMap,
    visibleRegions,
    view.initialized,
    width,
    bpPerPx,
    model,
  )

  return (
    <>
      <OverlayLayer>{highlightOverlays}</OverlayLayer>
      <OverlayLayer>{floatingLabelElements}</OverlayLayer>
      <PeptideCanvas
        renderDataMap={renderDataMap}
        visibleRegions={visibleRegions}
        viewInitialized={view.initialized}
        width={width}
        height={model.hasOverflow ? model.maxY : model.height}
        bpPerPx={bpPerPx}
      />
    </>
  )
})

// Wraps the overlays in the shared ScrollLockedOverlay so labels/highlights
// track the GPU canvas's model.scrollTop rather than the native compositor
// scroll (see ScrollLockedOverlay for why). Its own observer so only this thin
// wrapper re-renders per scroll frame, not the whole FeatureBody tree (Overlays
// is passed as stable children and doesn't re-run).
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
// hit-testing, and the canvas itself; Overlays (memoized) owns the label /
// highlight / peptide layers.
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

  const openContextMenu = useCallback(
    (
      feature: FlatbushItem,
      displayedRegionIndex: number,
      clientX: number,
      clientY: number,
    ) => {
      // contextMenuInfo (set here) is all the menu needs — it carries
      // featureId/startBp/endBp/type plus the click position synchronously, and
      // each item that needs the full feature re-fetches it on click. Opening
      // the menu immediately avoids gating the right-click on an RPC round-trip.
      model.showContextMenuForFeature(
        feature,
        displayedRegionIndex,
        clientX,
        clientY,
      )
    },
    [model],
  )

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
    const next = applyScroll(e, {
      scrollTop: model.scrollTop,
      viewportHeight: model.height,
      scrollableHeight: model.scrollableHeight,
    })
    if (next !== null) {
      model.setScrollTop(next)
    }
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
        result.displayedRegionIndex,
      )
    } else {
      model.clearHover()
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { hoveredFeature, hoveredSubfeature, hoveredRegionIndex } = model
    // Ctrl/Cmd+click builds the "show only these features" collection instead
    // of opening the feature details, so several features can be tagged while
    // they're all still visible, then isolated together via the context menu.
    if ((e.ctrlKey || e.metaKey) && hoveredFeature) {
      model.toggleSoloFeature(hoveredFeature.featureId)
    } else if (hoveredFeature && hoveredRegionIndex !== undefined) {
      model.selectFeatureById(
        hoveredFeature.featureId,
        hoveredSubfeature ?? undefined,
        hoveredRegionIndex,
      )
    } else {
      model.clearSelection()
    }
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { hoveredFeature, hoveredRegionIndex } = model
    if (hoveredFeature && hoveredRegionIndex !== undefined) {
      e.preventDefault()
      openContextMenu(hoveredFeature, hoveredRegionIndex, e.clientX, e.clientY)
    }
  }

  const handleMouseLeave = () => {
    if (!model.contextMenuInfo) {
      model.clearHover()
    }
  }

  const onLabelMouseOver = useCallback(
    (item: FlatbushItem, displayedRegionIndex: number, e: React.MouseEvent) => {
      setClientXY([e.clientX, e.clientY])
      model.setHover(item.featureId, null, item.tooltip, displayedRegionIndex)
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
        onMouseLeave={() => {
          handleMouseLeave()
        }}
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
        <Overlays
          model={model}
          view={view}
          openContextMenu={openContextMenu}
          onLabelMouseOver={onLabelMouseOver}
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
        <IsoformCollapseNotice
          visible={model.showIsoformCollapseNotice}
          onDismiss={() => {
            model.dismissIsoformCollapseNotice()
          }}
        />
        <OverflowIndicator
          autoHeight={model.autoHeight}
          expanded={model.heightBeforeExpand !== undefined}
          canExpand={model.canExpand}
          hasOverflow={model.hasOverflow}
          scrollZoom={view.scrollZoom}
          onExpand={() => {
            model.expandToFit()
          }}
          onRestore={() => {
            model.collapseFromExpand()
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
