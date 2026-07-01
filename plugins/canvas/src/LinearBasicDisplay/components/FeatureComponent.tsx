import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import BottomRightIndicators from './BottomRightIndicators.tsx'
import { CanvasFeatureRenderer } from './CanvasFeatureRenderer.ts'
import FeatureTooltip from './FeatureTooltip.tsx'
import IsoformCollapseNotice from './IsoformCollapseNotice.tsx'
import OverflowIndicator from './OverflowIndicator.tsx'
import PeptideCanvas from './PeptideCanvas.tsx'
import { hoverTooltip, performMultiRegionHitDetection } from './hitTesting.ts'
import {
  useFloatingLabels,
  useHighlightOverlays,
} from './useOverlayElements.tsx'
import { useScrollSync } from './useScrollSync.ts'
import { MORPH_DURATION_MS } from '../yMorph.ts'

import type { CanvasFeatureRenderingBackend } from './canvasFeatureRenderingBackendTypes.ts'
import type { FeatureItemEntry, FlatbushRegionIndexes } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
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
  heightBeforeExpand: number | undefined
  autoHeight: boolean
  showLabels: boolean
  selectedFeatureId: string | undefined
  featureIdUnderMouse: string | null
  subfeatureIdUnderMouse: string | null
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
  ) => void
  selectFeatureById: (
    featureInfo: FlatbushItem,
    subfeatureInfo: SubfeatureInfo | undefined,
    displayedRegionIndex: number,
  ) => void
  showContextMenuForFeature: (
    featureInfo: FlatbushItem,
    displayedRegionIndex: number,
  ) => void
  contextMenuInfo:
    { item: FlatbushItem; displayedRegionIndex: number } | undefined
  setContextMenuInfo: (info?: {
    item: FlatbushItem
    displayedRegionIndex: number
  }) => void
  setContextMenuFeature: (feature?: Feature) => void
  fetchFullFeature: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<Feature | undefined>
  contextMenuItems: () => { label: string; onClick: () => void }[]
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
  scrollContainer: {
    position: 'absolute',
    inset: 0,
    overflowX: 'hidden',
  },
  content: {
    position: 'relative',
    minHeight: '100%',
  },
  canvas: {
    display: 'block',
    position: 'sticky',
    top: 0,
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
  contextCoord,
  onClose,
}: {
  model: LinearBasicDisplayModel
  contextCoord: [number, number]
  onClose: () => void
}) {
  const items = model.contextMenuItems()
  return (
    <Menu
      open={items.length > 0}
      onMenuItemClick={callback => {
        callback()
        onClose()
      }}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{
        top: contextCoord[1],
        left: contextCoord[0],
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
  onLabelMouseOver: (item: FlatbushItem, e: React.MouseEvent) => void
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
      {({ canvasRef }) => <FeatureBody model={model} canvasRef={canvasRef} />}
    </DisplayChrome>
  )
})

const FeatureBody = observer(function FeatureBody({
  model,
  canvasRef,
}: Props & { canvasRef: (node: HTMLCanvasElement | null) => void }) {
  // false positive: omitting <[number,number]> widens to number[] — known tuple issue
  // https://github.com/typescript-eslint/typescript-eslint/issues/9529
  const [clientXY, setClientXY] = useState<[number, number]>([0, 0])
  const [contextMenuCoord, setContextMenuCoord] = useState<
    [number, number] | undefined
  >()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { classes } = useStyles()

  const view = getContainingView(model) as LGV

  const width = view.initialized ? view.trackWidthPx : undefined
  const height = model.height

  const openContextMenu = useCallback(
    async (
      feature: FlatbushItem,
      displayedRegionIndex: number,
      clientX: number,
      clientY: number,
    ) => {
      // Set contextMenuInfo synchronously so hover guards below can see it
      // during the async fetch window (before contextMenuCoord is set).
      model.showContextMenuForFeature(feature, displayedRegionIndex)
      const fullFeature = await model.fetchFullFeature(
        feature.featureId,
        displayedRegionIndex,
      )
      if (!isAlive(model)) {
        return
      }
      model.setContextMenuFeature(fullFeature ?? undefined)
      setContextMenuCoord([clientX, clientY])
    },
    [model],
  )

  // The model owns the upload/render autorun and the GPU backend lifecycle —
  // see startRenderingBackend / stopRenderingBackend / renderNow on the
  // base canvas display model. scrollTop lives on the model (via
  // TrackHeightMixin); the scroll handler below writes DOM scrollTop into
  // the model so the autorun picks it up as part of `renderState`.
  useScrollSync(scrollContainerRef, model, view)

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

  const handleClick = () => {
    const { hoveredFeature, hoveredSubfeature } = model
    if (hoveredFeature) {
      const entry = model.featureItemMap.get(hoveredFeature.featureId)
      if (entry) {
        model.selectFeatureById(
          hoveredFeature,
          hoveredSubfeature ?? undefined,
          entry.vr.displayedRegionIndex,
        )
      }
    } else {
      model.clearSelection()
    }
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { hoveredFeature } = model
    if (hoveredFeature) {
      e.preventDefault()
      const entry = model.featureItemMap.get(hoveredFeature.featureId)
      if (entry) {
        void openContextMenu(
          hoveredFeature,
          entry.vr.displayedRegionIndex,
          e.clientX,
          e.clientY,
        )
      }
    }
  }

  const handleMouseLeave = () => {
    if (!model.contextMenuInfo) {
      model.clearHover()
    }
  }

  const onLabelMouseOver = useCallback(
    (item: FlatbushItem, e: React.MouseEvent) => {
      setClientXY([e.clientX, e.clientY])
      model.setHover(item.featureId, null, item.tooltip)
    },
    [model],
  )

  return (
    <>
      <div
        ref={scrollContainerRef}
        className={classes.scrollContainer}
        style={{ overflowY: model.hasOverflow ? 'auto' : 'hidden' }}
      >
        <div
          className={classes.content}
          style={{ height: model.hasOverflow ? model.maxY : '100%' }}
        >
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => {
              handleMouseLeave()
            }}
            onClick={() => {
              handleClick()
            }}
            onContextMenu={handleContextMenu}
            className={classes.canvas}
            style={{
              width,
              height,
              cursor: model.hoveredFeature ? 'pointer' : 'default',
            }}
          />

          <Overlays
            model={model}
            view={view}
            openContextMenu={openContextMenu}
            onLabelMouseOver={onLabelMouseOver}
          />
        </div>
      </div>

      <BottomRightIndicators hasOverflow={model.hasOverflow}>
        <IsoformCollapseNotice
          visible={model.showIsoformCollapseNotice}
          onDismiss={() => {
            model.dismissIsoformCollapseNotice()
          }}
        />
        <OverflowIndicator
          autoHeight={model.autoHeight}
          expanded={model.heightBeforeExpand !== undefined}
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
      {contextMenuCoord ? (
        <ContextMenu
          model={model}
          contextCoord={contextMenuCoord}
          onClose={() => {
            setContextMenuCoord(undefined)
            model.setContextMenuInfo(undefined)
            model.clearHover()
          }}
        />
      ) : null}
    </>
  )
})

export default FeatureComponent
