import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import {
  getContainingView,
  useGpuRenderer,
  useTabVisibilityRerender,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { uploadChangedRegions } from '@jbrowse/core/gpu/uploadChangedRegions'
import { AlignmentsRenderer } from './AlignmentsRenderer.ts'
import {
  buildColorPaletteFromTheme,
  formatCigarTooltip,
  formatCoverageTooltip,
  formatIndicatorTooltip,
  getCanvasCoords,
  uploadRegionDataToGPU,
} from './alignmentComponentUtils.ts'
import { performHitTest } from './hitTestPipeline.ts'
import {
  openCigarWidget,
  openCoverageWidget,
  openIndicatorWidget,
} from './openFeatureWidget.ts'
import { getContrastBaseMap } from '../../shared/util.ts'

import type { ColorPalette } from './AlignmentsRenderer.ts'
import type { CoverageTicks } from './CoverageYScaleBar.tsx'
import type { VisibleLabel } from './computeVisibleLabels.ts'
import type {
  CigarHitResult,
  IndicatorHitResult,
  ResolvedBlock,
} from './hitTesting.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type {
  LegendItem,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

interface FeatureInfo {
  id: string
  name: string
  start: number
  end: number
  flags: number | undefined
  mapq: number | undefined
  strand: string
  refName: string
}

export interface LinearAlignmentsDisplayModel {
  height: number
  rpcDataMap: Map<number, PileupDataResult>
  isLoading: boolean
  error: Error | null
  featureHeightSetting: number
  featureSpacing: number
  showCoverage: boolean
  coverageHeight: number
  showArcs: boolean
  arcsHeight: number
  pairedArcsDown: boolean
  sashimiArcsHeight: number
  coverageDisplayHeight: number
  showInterbaseIndicators: boolean
  showSashimiArcs: boolean
  sashimiArcsDown: boolean
  totalPileupHeight: number
  scrollableHeight: number
  pileupViewportHeight: number
  regionTooLarge: boolean
  regionTooLargeReason: string
  setFeatureDensityStatsLimit: (s?: unknown) => void
  reload: () => void
  featureIdUnderMouse: string | undefined
  coverageTicks?: CoverageTicks
  showLegend: boolean | undefined
  legendItems: LegendItem[]
  currentRangeY: [number, number]
  highlightedChainIds: string[]
  selectedChainIds: string[]
  chainIdMap: Map<number, string[]>
  overCigarItem: boolean
  visibleLabels: VisibleLabel[]
  isChainMode: boolean
  setOverCigarItem: (flag: boolean) => void
  colorPalette: ColorPalette | null
  colorSchemeIndex: number
  dataVersion: number
  canvasDrawn: boolean
  arcsState: {
    rpcDataMap: Map<
      number,
      {
        regionStart: number
        arcX1: Float32Array
        arcX2: Float32Array
        arcColorTypes: Float32Array
        arcIsArc: Uint8Array
        numArcs: number
        linePositions: Uint32Array
        lineYs: Float32Array
        lineColorTypes: Float32Array
        numLines: number
      }
    >
    dataVersion: number
    lineWidth: number
    drawInter: boolean
  }
  showMismatches: boolean
  showSoftClipping: boolean
  showModifications: boolean
  showOutlineSetting: boolean
  selectedFeatureId: string | undefined
  flipStrandLongReadChains: boolean
  setMaxY: (val: number) => void
  setColorPalette: (palette: ColorPalette | null) => void
  setCanvasDrawn: (val: boolean) => void
  setCurrentRangeY: (rangeY: [number, number]) => void
  setCoverageHeight: (height: number) => void
  setArcsHeight: (height: number) => void
  setSashimiArcsHeight: (height: number) => void
  setHighlightedChainIds: (ids: string[]) => void
  setSelectedChainIds: (ids: string[]) => void
  clearHighlights: () => void
  clearMouseoverState: () => void
  clearSelection: () => void
  setFeatureIdUnderMouse: (id: string | undefined) => void
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (featureId: string) => void
  setContextMenuFeatureById: (featureId: string) => void
  setContextMenuCoord: (coord?: [number, number]) => void
  setContextMenuCigarHit: (hit?: CigarHitResult) => void
  setContextMenuIndicatorHit: (hit?: IndicatorHitResult) => void
  setContextMenuRefName: (refName?: string) => void
  contextMenuCoord: [number, number] | undefined
  contextMenuItems: () => {
    label: string
    onClick: () => void
    icon?: unknown
  }[]
  setContextMenuFeature: (feature?: unknown) => void
  getFeatureInfoById: (featureId: string) => FeatureInfo | undefined
  renderingMode: 'pileup' | 'linkedRead'
  scalebarOverlapLeft: number
  clearAllRpcData: () => void
  setError: (error?: unknown) => void
}

export interface FeatureHit {
  id: string
  index: number
}

export function useAlignmentsBase(model: LinearAlignmentsDisplayModel) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [resizeHandleHovered, setResizeHandleHovered] = useState(false)
  const [arcsResizeHovered, setArcsResizeHovered] = useState(false)
  const [sashimiResizeHovered, setSashimiResizeHovered] = useState(false)

  const canvasRectRef = useRef<{ rect: DOMRect; timestamp: number } | null>(
    null,
  )
  const dragRef = useRef({ isDragging: false, lastX: 0 })

  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const colorPalette = useMemo(() => buildColorPaletteFromTheme(theme), [theme])
  const contrastMap = useMemo(() => getContrastBaseMap(theme), [theme])

  const {
    featureHeightSetting,
    featureSpacing,
    showCoverage,
    coverageHeight,
    arcsHeight,
    coverageDisplayHeight: topOffset,
    showInterbaseIndicators,
    isChainMode,
  } = model

  const width = view.initialized ? view.width : undefined

  function resolveBlockForCanvasX(canvasX: number): ResolvedBlock | undefined {
    if (!view.initialized) {
      return undefined
    }

    const regions = view.visibleRegions
    const dataMap = model.rpcDataMap

    for (const r of regions) {
      if (canvasX >= r.screenStartPx && canvasX < r.screenEndPx) {
        const data = dataMap.get(r.regionNumber)
        if (data) {
          return {
            rpcData: data,
            bpRange: [r.start, r.end],
            blockStartPx: r.screenStartPx,
            blockWidth: r.screenEndPx - r.screenStartPx,
            refName: r.refName,
            reversed: r.reversed ?? false,
          }
        }
      }
    }
    return undefined
  }

  // --- Shared event handlers ---

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    dragRef.current = { isDragging: true, lastX: e.clientX }
  }

  function handleDragMove(e: React.MouseEvent) {
    if (!dragRef.current.isDragging) {
      return
    }
    e.stopPropagation()

    const dx = e.clientX - dragRef.current.lastX
    dragRef.current.lastX = e.clientX

    if (dx !== 0) {
      const minOffset = view.minOffset
      const maxOffset = view.maxOffset
      const newOffsetPx = Math.max(
        minOffset,
        Math.min(maxOffset, view.offsetPx - dx),
      )
      view.setNewView(view.bpPerPx, newOffsetPx)
    }
  }

  function handleMouseUp() {
    dragRef.current.isDragging = false
  }

  function handleMouseLeave() {
    dragRef.current.isDragging = false
    model.clearMouseoverState()
  }

  function handleResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = coverageHeight

    const onMouseMove = (moveEvent: MouseEvent) => {
      model.setCoverageHeight(
        Math.max(20, startHeight + moveEvent.clientY - startY),
      )
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function handleArcsResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = arcsHeight

    const onMouseMove = (moveEvent: MouseEvent) => {
      model.setArcsHeight(
        Math.max(20, startHeight + moveEvent.clientY - startY),
      )
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function handleSashimiArcsResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = model.sashimiArcsHeight

    const onMouseMove = (moveEvent: MouseEvent) => {
      model.setSashimiArcsHeight(
        Math.max(20, startHeight + moveEvent.clientY - startY),
      )
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function handleContextMenu(e: React.MouseEvent) {
    const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
    if (!coords) {
      return
    }

    const resolved = resolveBlockForCanvasX(coords.canvasX)
    const result = performHitTest(coords.canvasX, coords.canvasY, resolved, {
      showCoverage,
      showInterbaseIndicators,
      coverageHeight,
      topOffset,
      featureHeightSetting,
      featureSpacing,
      rangeY: model.currentRangeY,
      isChainMode,
    })
    if (
      result.type === 'cigar' ||
      result.type === 'indicator' ||
      result.type === 'feature'
    ) {
      e.preventDefault()
      model.setContextMenuCoord([e.clientX, e.clientY])
      model.setContextMenuRefName(resolved?.refName)
      model.setContextMenuCigarHit(
        result.type === 'cigar' ? result.hit : undefined,
      )
      model.setContextMenuIndicatorHit(
        result.type === 'indicator' ? result.hit : undefined,
      )
      if (result.type === 'cigar' && result.featureHit) {
        model.setContextMenuFeatureById(result.featureHit.id)
      } else if (result.type === 'feature') {
        model.setContextMenuFeatureById(result.hit.id)
      }
    }
  }

  // --- Hit test processing helpers ---

  function processMouseMove(
    e: React.MouseEvent,
    onFeature: (hit: FeatureHit, resolved: ResolvedBlock) => void,
    onNoFeature: () => void,
  ) {
    if (dragRef.current.isDragging) {
      handleDragMove(e)
      return
    }

    const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
    if (!coords) {
      return
    }

    const resolved = resolveBlockForCanvasX(coords.canvasX)
    const result = performHitTest(coords.canvasX, coords.canvasY, resolved, {
      showCoverage,
      showInterbaseIndicators,
      coverageHeight,
      topOffset,
      featureHeightSetting,
      featureSpacing,
      rangeY: model.currentRangeY,
      isChainMode,
    })

    if (result.type === 'indicator') {
      model.setOverCigarItem(true)
      model.setFeatureIdUnderMouse(undefined)
      model.setMouseoverExtraInformation(
        formatIndicatorTooltip(
          result.hit.position,
          result.resolved.rpcData,
          result.resolved.refName,
        ),
      )
      model.clearHighlights()
      return
    }

    if (result.type === 'coverage') {
      model.setOverCigarItem(true)
      model.setFeatureIdUnderMouse(undefined)
      model.setMouseoverExtraInformation(
        formatCoverageTooltip(
          result.hit.position,
          result.resolved.rpcData,
          result.resolved.refName,
        ),
      )
      model.clearHighlights()
      return
    }

    if (result.type === 'cigar') {
      model.setOverCigarItem(true)
      model.setMouseoverExtraInformation(formatCigarTooltip(result.hit))
      model.setFeatureIdUnderMouse(result.featureHit?.id)
      return
    }

    model.setOverCigarItem(false)

    if (result.type === 'feature') {
      onFeature(result.hit, result.resolved)
    } else {
      onNoFeature()
    }
  }

  function processClick(
    e: React.MouseEvent,
    onFeature: (hit: FeatureHit, resolved: ResolvedBlock) => void,
    onNoFeature: () => void,
  ) {
    const coords = getCanvasCoords(e, canvasRef, canvasRectRef)
    if (!coords) {
      return
    }
    const { canvasX, canvasY } = coords

    const resolved = resolveBlockForCanvasX(canvasX)

    const result = performHitTest(canvasX, canvasY, resolved, {
      showCoverage,
      showInterbaseIndicators,
      coverageHeight,
      topOffset,
      featureHeightSetting,
      featureSpacing,
      rangeY: model.currentRangeY,
      isChainMode,
    })

    if (result.type === 'indicator') {
      const refName = result.resolved.refName
      openIndicatorWidget(model, result.hit, refName, result.resolved.rpcData)
      return
    }

    if (result.type === 'coverage') {
      const refName = result.resolved.refName
      openCoverageWidget(
        model,
        result.hit.position,
        refName,
        result.resolved.rpcData,
      )
      return
    }

    if (result.type === 'cigar') {
      const refName = result.resolved.refName
      openCigarWidget(model, result.hit, refName)
      return
    }

    if (result.type === 'feature') {
      onFeature(result.hit, result.resolved)
    } else {
      onNoFeature()
    }
  }

  // --- Effects ---

  const {
    error: gpuError,
    ready,
    rendererRef,
    retry,
  } = useGpuRenderer(canvasRef, AlignmentsRenderer)

  useEffect(() => {
    model.setColorPalette(colorPalette)
  }, [model, colorPalette])

  const renderNow = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer || !view.initialized) {
      return
    }
    const palette = model.colorPalette
    if (!palette) {
      return
    }
    const regions = view.visibleRegions
    renderer.renderBlocks(
      buildRenderBlocks(regions),
      {
        rangeY: model.currentRangeY,
        colorScheme: model.colorSchemeIndex,
        featureHeight: model.featureHeightSetting,
        featureSpacing: model.featureSpacing,
        showCoverage: model.showCoverage,
        coverageHeight: model.coverageHeight,
        coverageYOffset: YSCALEBAR_LABEL_OFFSET,
        coverageNicedMax: model.coverageTicks?.nicedMax,
        showMismatches: model.showMismatches,
        showSoftClipping: model.showSoftClipping,
        showInterbaseIndicators: model.showInterbaseIndicators,
        showModifications: model.showModifications,
        showOutline: model.showOutlineSetting,
        showArcs: model.showArcs,
        arcsHeight: model.arcsHeight,
        pairedArcsDown: model.pairedArcsDown,
        pileupTopOffset: model.coverageDisplayHeight,
        canvasWidth: view.width,
        canvasHeight: model.height,
        highlightedFeatureId: model.featureIdUnderMouse,
        selectedFeatureId: model.selectedFeatureId,
        highlightedChainIds: model.highlightedChainIds,
        selectedChainIds: model.selectedChainIds,
        colors: palette,
        renderingMode: model.renderingMode,
        flipStrandLongReadChains: model.flipStrandLongReadChains,
        arcLineWidth: model.arcsState.lineWidth,
        bpRangeX: [0, 0],
      },
    )
  }, [model, view, rendererRef])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    let lastRpcDataMap: Map<number, PileupDataResult> | null = null
    let lastArcsDataMap: Map<number, unknown> | null = null
    const lastUploaded = new Map<number, unknown>()
    const lastConnectingUploaded = new Map<number, unknown>()
    const lastArcsUploaded = new Map<number, unknown>()

    return autorun(() => {
      const rpcDataMap = model.rpcDataMap

      if (lastRpcDataMap !== rpcDataMap) {
        lastRpcDataMap = rpcDataMap
        const maxYVal = uploadRegionDataToGPU(renderer, rpcDataMap, lastUploaded)
        if (maxYVal > 0) {
          model.setMaxY(maxYVal)
        }
        uploadChangedRegions(rpcDataMap, lastConnectingUploaded, (regionNumber, data) => {
          if (
            data.connectingLinePositions &&
            data.connectingLineYs &&
            data.connectingLineColorTypes &&
            data.numConnectingLines
          ) {
            renderer.uploadConnectingLinesForRegion(regionNumber, {
              regionStart: data.regionStart,
              connectingLinePositions: data.connectingLinePositions,
              connectingLineYs: data.connectingLineYs,
              connectingLineColorTypes: data.connectingLineColorTypes,
              numConnectingLines: data.numConnectingLines,
            })
          }
        })
      }

      const arcsRpcDataMap = model.arcsState.rpcDataMap
      if (lastArcsDataMap !== arcsRpcDataMap) {
        lastArcsDataMap = arcsRpcDataMap
        uploadChangedRegions(arcsRpcDataMap, lastArcsUploaded, (regionNumber, data) => {
          renderer.uploadArcsFromTypedArraysForRegion(regionNumber, {
            regionStart: data.regionStart,
            arcX1: data.arcX1,
            arcX2: data.arcX2,
            arcColorTypes: data.arcColorTypes,
            arcIsArc: data.arcIsArc,
            numArcs: data.numArcs,
            linePositions: data.linePositions,
            lineYs: data.lineYs,
            lineColorTypes: data.lineColorTypes,
            numLines: data.numLines,
          })
        })
      }

      // SYNC across all hook-driven GPU displays (wiggle, multi-wiggle,
      // variants, alignments, HiC, LD): dataVersion is a counter incremented
      // by setLoadedRegionForRegion() after each region's data is committed.
      // Reading it here creates a MobX dependency so this autorun re-fires at
      // that point, ensuring renderNow() runs with fully-committed data.
      // See MultiRegionDisplayMixin.withFetchLifecycle.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _dv = model.dataVersion
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _adv = model.arcsState.dataVersion

      renderNow()
      if (rpcDataMap.size > 0) {
        model.setCanvasDrawn(true)
      }
    })
  }, [model, view, ready, rendererRef, renderNow])

  useTabVisibilityRerender(renderNow)

  return {
    canvasRef,
    gpuError,
    retry,
    resizeHandleHovered,
    setResizeHandleHovered,
    width,
    contrastMap,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleResizeMouseDown,
    handleArcsResizeMouseDown,
    arcsResizeHovered,
    setArcsResizeHovered,
    handleSashimiArcsResizeMouseDown,
    sashimiResizeHovered,
    setSashimiResizeHovered,
    handleContextMenu,
    processMouseMove,
    processClick,
  }
}
