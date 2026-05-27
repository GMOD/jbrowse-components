import React, { useCallback, useRef, useState } from 'react'

import { ErrorOverlay, LoadingOverlay, Menu } from '@jbrowse/core/ui'
import { getContainingView, useGpuBackend } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
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

import type { CanvasFeatureBackend } from './canvasFeatureBackendTypes.ts'
import type {
  FeatureItemEntry,
  FlatbushRegionIndexes,
  VisibleRegion,
} from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// Hand-rolled structural type, NOT `Instance<typeof stateModelFactory>`. The
// MST factory references this component via `lazy()`, so importing the real
// model type back into the component creates a circular type reference that
// breaks inference across the whole file. Keep this in sync when adding
// model fields the component reads.
interface LinearBasicDisplayModel {
  height: number
  laidOutDataMap: Map<number, FeatureDataResult>
  visibleRegions: VisibleRegion[]
  featureItemMap: Map<string, FeatureItemEntry>
  isReady: boolean
  error: Error | null
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
  regionTooLarge: boolean
  regionTooLargeReason: string
  regionCannotBeRendered: () => React.ReactNode
  featureDensityStats?: { bytes?: number }
  statusMessage: string | undefined
  setScrollTop: (n: number) => void
  setFeatureDensityStatsLimit: (s?: { bytes?: number }) => void
  reload: () => void
  expandToFit: () => void
  collapseFromExpand: () => void
  setFeatureIdUnderMouse: (featureId: string | null) => void
  setSubfeatureIdUnderMouse: (featureId: string | null) => void
  clearHover: () => void
  mouseoverExtraInformation: string | undefined
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (
    featureInfo: FlatbushItem,
    subfeatureInfo: SubfeatureInfo | undefined,
    displayedRegionIndex: number,
  ) => void
  showContextMenuForFeature: (
    featureInfo: FlatbushItem,
    displayedRegionIndex: number,
  ) => void
  contextMenuInfo: unknown
  setContextMenuInfo: (info?: unknown) => void
  setContextMenuFeature: (feature?: unknown) => void
  fetchFullFeature: (
    featureId: string,
    displayedRegionIndex: number,
  ) => Promise<unknown>
  contextMenuItems: () => { label: string; onClick: () => void }[]
  getFeatureById: (featureId: string) => FlatbushItem | undefined
  clearSelection: () => void
  startBackend: (backend: CanvasFeatureBackend) => void
  stopBackend: () => void
  renderNow: () => void
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
      onMenuItemClick={(_, callback) => {
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

const FeatureComponent = observer(function FeatureComponent({ model }: Props) {
  // false positive: omitting <[number,number]> widens to number[] — known tuple issue
  // https://github.com/typescript-eslint/typescript-eslint/issues/9529
  const [clientXY, setClientXY] = useState<[number, number]>([0, 0])
  const [contextMenuCoord, setContextMenuCoord] = useState<
    [number, number] | undefined
  >()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { classes } = useStyles()

  const view = getContainingView(model) as LGV

  const { laidOutDataMap, error: modelError } = model

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
      model.setMouseoverExtraInformation(undefined)
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
  // see startBackend / stopBackend / renderNow on the
  // base canvas display model. scrollTop lives on the model (via
  // TrackHeightMixin); the scroll handler below writes DOM scrollTop into
  // the model so the autorun picks it up as part of `renderState`.
  const {
    canvasRef,
    error: gpuError,
    retry,
  } = useGpuBackend(CanvasFeatureRenderer, model)

  const error = gpuError || modelError

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
    if (contextMenuCoord || model.contextMenuInfo) {
      return
    }
    setClientXY([e.clientX, e.clientY])
    if (model.laidOutDataMap.size === 0) {
      model.clearHover()
      return
    }

    const result = hitTestAtEvent(e)

    if (result.feature) {
      if (result.subfeature) {
        model.setMouseoverExtraInformation(
          result.subfeature.tooltip ?? result.subfeature.type,
        )
        model.setSubfeatureIdUnderMouse(result.subfeature.featureId)
      } else {
        model.setMouseoverExtraInformation(result.feature.tooltip)
        model.setSubfeatureIdUnderMouse(null)
      }
      model.setFeatureIdUnderMouse(result.feature.featureId)
    } else {
      model.clearHover()
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (model.laidOutDataMap.size === 0) {
      return
    }
    const result = hitTestAtEvent(e)
    if (result.feature) {
      model.selectFeatureById(
        result.feature,
        result.subfeature ?? undefined,
        result.displayedRegionIndex,
      )
    } else {
      model.clearSelection()
    }
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (model.laidOutDataMap.size === 0) {
      return
    }
    const result = hitTestAtEvent(e)
    if (result.feature) {
      e.preventDefault()
      void openContextMenu(
        result.feature,
        result.displayedRegionIndex,
        e.clientX,
        e.clientY,
      )
    }
  }

  const handleMouseLeave = () => {
    if (!contextMenuCoord && !model.contextMenuInfo) {
      model.clearHover()
    }
  }

  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions

  const onLabelMouseOver = useCallback(
    (item: FlatbushItem, e: React.MouseEvent) => {
      setClientXY([e.clientX, e.clientY])
      model.setFeatureIdUnderMouse(item.featureId)
      model.setSubfeatureIdUnderMouse(null)
      model.setMouseoverExtraInformation(item.tooltip)
    },
    [model],
  )

  const floatingLabelElements = useFloatingLabels(
    laidOutDataMap,
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

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width ?? '100%'}
        height={height}
        onRetry={() => {
          retry()
          model.reload()
        }}
      />
    )
  }

  if (model.regionTooLarge) {
    return model.regionCannotBeRendered()
  }

  return (
    <div className={classes.root} style={{ height }}>
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
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
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

      <CanvasLoadingOverlay model={model} />
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
    </div>
  )
})

const CanvasLoadingOverlay = observer(function CanvasLoadingOverlay({
  model,
}: {
  model: Pick<LinearBasicDisplayModel, 'isReady' | 'statusMessage'>
}) {
  return (
    <LoadingOverlay
      statusMessage={model.statusMessage}
      isVisible={!model.isReady}
    />
  )
})

export default FeatureComponent
