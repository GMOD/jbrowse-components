import React, { useCallback, useRef, useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import { CanvasFeatureRenderer } from './CanvasFeatureRenderer.ts'
import FeatureTooltip from './FeatureTooltip.tsx'
import OverflowIndicator from './OverflowIndicator.tsx'
import { performMultiRegionHitDetection } from './hitTesting.ts'
import {
  useAminoAcidOverlay,
  useFloatingLabels,
  useHighlightOverlays,
} from './useOverlayElements.tsx'
import { useScrollSync } from './useScrollSync.ts'

import type { CanvasFeatureRenderingBackend } from './canvasFeatureRenderingBackendTypes.ts'
import type { FeatureItemEntry, FlatbushRegionIndexes } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  featureItemMap: Map<string, FeatureItemEntry>
  loadingOverlayVisible: boolean
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
    | { item: FlatbushItem; displayedRegionIndex: number }
    | undefined
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

// Thin outer owns the DisplayChrome; FeatureBody owns the scroll container,
// hit-testing, overlay hooks, and the canvas itself.
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

  const { laidOutDataMap } = model

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

  const hitTestAtEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0
    const yPos = mouseY + scrollTop
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
      const sub = result.subfeature
      model.setHover(
        result.feature.featureId,
        sub?.featureId ?? null,
        sub ? (sub.tooltip ?? sub.type) : result.feature.tooltip,
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

  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions

  const onLabelMouseOver = useCallback(
    (item: FlatbushItem, e: React.MouseEvent) => {
      setClientXY([e.clientX, e.clientY])
      model.setHover(item.featureId, null, item.tooltip)
    },
    [model],
  )

  const floatingLabelElements = useFloatingLabels(
    laidOutDataMap,
    model.featureItemMap,
    visibleRegions,
    view.initialized,
    width,
    bpPerPx,
    model,
    openContextMenu,
    onLabelMouseOver,
  )

  const aminoAcidOverlayElements = useAminoAcidOverlay(
    laidOutDataMap,
    visibleRegions,
    view.initialized,
    width,
    bpPerPx,
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

          {highlightOverlays ? (
            <div className={classes.overlay}>{highlightOverlays}</div>
          ) : null}
          {floatingLabelElements ? (
            <div className={classes.overlay}>{floatingLabelElements}</div>
          ) : null}
          {aminoAcidOverlayElements ? (
            <div className={classes.overlay}>{aminoAcidOverlayElements}</div>
          ) : null}
        </div>
      </div>

      {!model.autoHeight &&
      (model.hasOverflow || model.heightBeforeExpand !== undefined) ? (
        <OverflowIndicator
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
      ) : null}

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
