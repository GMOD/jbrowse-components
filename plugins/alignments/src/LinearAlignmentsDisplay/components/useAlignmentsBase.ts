import type React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { getContainingView, useGpuModelLifecycle } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { AlignmentsRenderer } from './AlignmentsRenderer.ts'
import {
  buildColorPaletteFromTheme,
  formatCigarTooltip,
  formatCoverageTooltip,
  formatIndicatorTooltip,
  formatModificationTooltip,
  getCanvasCoords,
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
import type { YScaleTicks } from './YScaleBar.tsx'
import type { VisibleLabel } from './computeVisibleLabels.ts'
import type {
  CigarHitResult,
  IndicatorHitResult,
  ResolvedBlock,
} from './hitTesting.ts'
import type { AlignmentsBackend } from './rendererTypes.ts'
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
  laidOutPileupMap: Map<number, PileupDataResult>
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
  regionCannotBeRendered: () => React.ReactNode
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
  canvasDrawn: boolean
  rpcDataMap: Map<number, PileupDataResult>
  coverageDomain: [number, number] | undefined
  coverageScaleType: string
  coverageAutoscaleType: string
  coverageMinScore: number | undefined
  coverageMaxScore: number | undefined
  setCoverageScaleType: (val: string) => void
  setCoverageAutoscaleType: (val: string) => void
  setCoverageMinScore: (val?: number) => void
  setCoverageMaxScore: (val?: number) => void
  arcsState: {
    rpcDataMap: Map<
      number,
      {
        arcX1: Uint32Array
        arcX2: Uint32Array
        arcColorTypes: Float32Array
        arcShapeTypes: Uint8Array
        arcYBp: Uint32Array
        numArcs: number
        linePositions: Uint32Array
        lineYs: Float32Array
        lineColorTypes: Float32Array
        numLines: number
      }
    >
    lineWidth: number
    drawInter: boolean
    colorByType: string
  }
  arcsYDomainBp: number | undefined
  insertSizeTicks: YScaleTicks | undefined
  showMismatches: boolean
  showSoftClipping: boolean
  showModifications: boolean
  showOutlineSetting: boolean
  selectedFeatureId: string | undefined
  flipStrandLongReadChains: boolean
  setColorPalette: (palette: ColorPalette | null) => void
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
  startGpuBackendLifecycle: (backend: AlignmentsBackend) => void
  stopGpuBackendLifecycle: () => void
  renderNow: () => void
}

export interface FeatureHit {
  id: string
  index: number
}

function makeResizeHandler(
  getHeight: () => number,
  setHeight: (h: number) => void,
) {
  return (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startHeight = getHeight()
    const onMouseMove = (moveEvent: MouseEvent) => {
      setHeight(Math.max(20, startHeight + moveEvent.clientY - startY))
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
}

export function useAlignmentsBase(model: LinearAlignmentsDisplayModel) {
  const {
    canvas,
    canvasRef,
    error: gpuError,
    retry,
  } = useGpuModelLifecycle(AlignmentsRenderer, model)
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
    const dataMap = model.laidOutPileupMap

    for (const r of regions) {
      if (canvasX >= r.screenStartPx && canvasX < r.screenEndPx) {
        const data = dataMap.get(r.displayedRegionIndex)
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
    if (!model.contextMenuCoord) {
      model.clearMouseoverState()
    }
  }

  const handleResizeMouseDown = makeResizeHandler(
    () => coverageHeight,
    h => {
      model.setCoverageHeight(h)
    },
  )

  const handleArcsResizeMouseDown = makeResizeHandler(
    () => arcsHeight,
    h => {
      model.setArcsHeight(h)
    },
  )

  const handleSashimiArcsResizeMouseDown = makeResizeHandler(
    () => model.sashimiArcsHeight,
    h => {
      model.setSashimiArcsHeight(h)
    },
  )

  function handleContextMenu(e: React.MouseEvent) {
    const coords = getCanvasCoords(e, canvas, canvasRectRef)
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

    const coords = getCanvasCoords(e, canvas, canvasRectRef)
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

    if (result.type === 'modification') {
      model.setOverCigarItem(true)
      model.setFeatureIdUnderMouse(result.featureHit?.id)
      const snpBase =
        result.cigarHit?.type === 'mismatch' ? result.cigarHit.base : undefined
      model.setMouseoverExtraInformation(
        formatModificationTooltip(
          result.hit.position,
          result.hit.modType,
          result.hit.probability,
          result.hit.color,
          result.resolved.refName,
          snpBase,
        ),
      )
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
    const coords = getCanvasCoords(e, canvas, canvasRectRef)
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

    if (result.type === 'modification') {
      openCoverageWidget(
        model,
        result.hit.position,
        result.resolved.refName,
        result.resolved.rpcData,
        result.hit.modType,
      )
      return
    }

    if (result.type === 'feature') {
      onFeature(result.hit, result.resolved)
    } else {
      onNoFeature()
    }
  }

  // --- Effects ---

  useEffect(() => {
    model.setColorPalette(colorPalette)
  }, [model, colorPalette])

  return {
    canvas,
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
