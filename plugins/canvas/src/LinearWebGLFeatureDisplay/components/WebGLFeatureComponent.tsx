import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  getContainingView,
  measureText,
  setupWebGLContextLossHandler,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { TooLargeMessage } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { WebGLFeatureRenderer } from './WebGLFeatureRenderer.ts'
import { computeLabelExtraWidth } from './highlightUtils.ts'
import { shouldRenderPeptideText } from '../../RenderWebGLFeatureDataRPC/zoomThresholds.ts'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'

import type { FeatureRenderBlock } from './WebGLFeatureRenderer.ts'
import type {
  FlatbushItem,
  SubfeatureInfo,
  WebGLFeatureDataResult,
} from '../../RenderWebGLFeatureDataRPC/rpcTypes.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface VisibleRegion {
  refName: string
  regionNumber: number
  start: number
  end: number
  assemblyName: string
  screenStartPx: number
  screenEndPx: number
}

interface LinearWebGLFeatureDisplayModel {
  height: number
  rpcDataMap: Map<number, WebGLFeatureDataResult>
  visibleRegions: VisibleRegion[]
  isLoading: boolean
  error: Error | null
  maxY: number
  selectedFeatureId: string | undefined
  featureIdUnderMouse: string | null
  regionTooLarge: boolean
  regionTooLargeReason: string
  setFeatureDensityStatsLimit: () => void
  reload: () => void
  setFeatureIdUnderMouse: (featureId: string | null) => void
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (
    featureInfo: FlatbushItem,
    subfeatureInfo?: SubfeatureInfo,
  ) => void
  showContextMenuForFeature: (featureInfo: FlatbushItem) => void
  getFeatureById: (featureId: string) => FlatbushItem | undefined
}

export interface Props {
  model: LinearWebGLFeatureDisplayModel
}

// Cache for reconstructed Flatbush indexes per region
interface FlatbushRegionCache {
  featureIndex: Flatbush | null
  subfeatureIndex: Flatbush | null
  flatbushData: ArrayBuffer | null
  subfeatureFlatbushData: ArrayBuffer | null
}

function getOrCreateFlatbushIndexes(
  cache: FlatbushRegionCache,
  flatbushData: ArrayBuffer,
  subfeatureFlatbushData: ArrayBuffer,
): { featureIndex: Flatbush | null; subfeatureIndex: Flatbush | null } {
  if (cache.flatbushData !== flatbushData) {
    cache.flatbushData = flatbushData
    cache.featureIndex = null
    if (flatbushData.byteLength > 0) {
      try {
        cache.featureIndex = Flatbush.from(flatbushData)
      } catch {
        // Index may be invalid
      }
    }
  }

  if (cache.subfeatureFlatbushData !== subfeatureFlatbushData) {
    cache.subfeatureFlatbushData = subfeatureFlatbushData
    cache.subfeatureIndex = null
    if (subfeatureFlatbushData.byteLength > 0) {
      try {
        cache.subfeatureIndex = Flatbush.from(subfeatureFlatbushData)
      } catch {
        // Index may be invalid
      }
    }
  }

  return {
    featureIndex: cache.featureIndex,
    subfeatureIndex: cache.subfeatureIndex,
  }
}

function performHitDetection(
  cache: FlatbushRegionCache,
  flatbushData: ArrayBuffer,
  flatbushItems: FlatbushItem[],
  subfeatureFlatbushData: ArrayBuffer,
  subfeatureInfos: SubfeatureInfo[],
  bpPos: number,
  yPos: number,
): { feature: FlatbushItem | null; subfeature: SubfeatureInfo | null } {
  let feature: FlatbushItem | null = null
  let subfeature: SubfeatureInfo | null = null

  const { featureIndex, subfeatureIndex } = getOrCreateFlatbushIndexes(
    cache,
    flatbushData,
    subfeatureFlatbushData,
  )

  // Check subfeatures first (more specific)
  if (subfeatureIndex && subfeatureInfos.length > 0) {
    const subHits = subfeatureIndex.search(bpPos, yPos, bpPos, yPos)
    for (const idx of subHits) {
      const info = subfeatureInfos[idx]
      if (info) {
        subfeature = info
        break
      }
    }
  }

  // Check features
  if (featureIndex && flatbushItems.length > 0) {
    const hits = featureIndex.search(bpPos, yPos, bpPos, yPos)
    for (const idx of hits) {
      const item = flatbushItems[idx]
      if (item) {
        feature = item
        break
      }
    }
  }

  return { feature, subfeature }
}

function performMultiRegionHitDetection(
  cacheMap: Map<number, FlatbushRegionCache>,
  rpcDataMap: Map<number, WebGLFeatureDataResult>,
  visibleRegions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
) {
  for (const vr of visibleRegions) {
    if (mouseXPx < vr.screenStartPx || mouseXPx > vr.screenEndPx) {
      continue
    }
    const data = rpcDataMap.get(vr.regionNumber)
    if (!data) {
      continue
    }
    let cache = cacheMap.get(vr.regionNumber)
    if (!cache) {
      cache = {
        featureIndex: null,
        subfeatureIndex: null,
        flatbushData: null,
        subfeatureFlatbushData: null,
      }
      cacheMap.set(vr.regionNumber, cache)
    }

    const blockWidth = vr.screenEndPx - vr.screenStartPx
    const bpPerPx = (vr.end - vr.start) / blockWidth
    const bpPos = vr.start + (mouseXPx - vr.screenStartPx) * bpPerPx

    return performHitDetection(
      cache,
      data.flatbushData,
      data.flatbushItems,
      data.subfeatureFlatbushData,
      data.subfeatureInfos,
      bpPos,
      yPos,
    )
  }
  return { feature: null, subfeature: null }
}

const WebGLFeatureComponent = observer(function WebGLFeatureComponent({
  model,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [measureRef, measuredDims] = useMeasure()
  const [rendererReady, setRendererReady] = useState(false)
  const [hoveredFeature, setHoveredFeature] = useState<FlatbushItem | null>(
    null,
  )
  const [hoveredSubfeature, setHoveredSubfeature] =
    useState<SubfeatureInfo | null>(null)
  const [scrollY, setScrollY] = useState(0)
  const flatbushCacheMapRef = useRef(new Map<number, FlatbushRegionCache>())
  const uploadedDataRef = useRef(new Map<number, WebGLFeatureDataResult>())

  const scrollYRef = useRef(0)
  const renderRAFRef = useRef<number | null>(null)
  const selfUpdateRef = useRef(false)

  const view = getContainingView(model) as LGV

  const { rpcDataMap, isLoading, error } = model

  const width =
    measuredDims.width ?? (view.initialized ? view.width : undefined)
  const height = model.height

  const renderWithBlocks = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer || !view.initialized || width === undefined) {
      return
    }

    const visibleRegions = view.visibleRegions
    if (visibleRegions.length === 0) {
      return
    }

    const blocks: FeatureRenderBlock[] = []
    for (const vr of visibleRegions) {
      blocks.push({
        regionNumber: vr.regionNumber,
        bpRangeX: [vr.start, vr.end],
        screenStartPx: vr.screenStartPx,
        screenEndPx: vr.screenEndPx,
      })
    }

    renderer.renderBlocks(blocks, {
      scrollY: scrollYRef.current,
      canvasWidth: Math.round(view.width),
      canvasHeight: height,
    })
  }, [view, width, height])

  const scheduleRender = useCallback(() => {
    if (renderRAFRef.current !== null) {
      cancelAnimationFrame(renderRAFRef.current)
    }
    renderRAFRef.current = requestAnimationFrame(() => {
      renderRAFRef.current = null
      renderWithBlocks()
    })
  }, [renderWithBlocks])

  const renderWithBlocksRef = useRef(renderWithBlocks)
  renderWithBlocksRef.current = renderWithBlocks
  const viewRef = useRef(view)
  viewRef.current = view

  const rendererRef = useRef<WebGLFeatureRenderer | null>(null)
  const [contextVersion, setContextVersion] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      return setupWebGLContextLossHandler(canvas, () => {
        setContextVersion(v => v + 1)
      })
    }
    return undefined
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    try {
      rendererRef.current = new WebGLFeatureRenderer(canvas)
      setRendererReady(true)
      if (contextVersion > 0) {
        uploadedDataRef.current.clear()
      }
    } catch (e) {
      console.error('Failed to initialize WebGL:', e)
    }
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [contextVersion])

  // Re-render when view state changes
  useEffect(() => {
    const dispose = autorun(() => {
      try {
        // Access observables to subscribe
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { offsetPx: _op, bpPerPx: _bpp, initialized } = view

        if (selfUpdateRef.current) {
          selfUpdateRef.current = false
          return
        }

        if (!initialized) {
          return
        }

        renderWithBlocksRef.current()
      } catch {
        // Model may have been detached from state tree
      }
    })

    return () => {
      dispose()
    }
  }, [view, model])

  // Upload features to GPU from RPC typed arrays (per region)
  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) {
      return
    }

    if (rpcDataMap.size === 0) {
      renderer.clearAllBuffers()
      uploadedDataRef.current.clear()
      return
    }

    const activeRegions = new Set<number>()
    for (const [regionNumber, data] of rpcDataMap) {
      activeRegions.add(regionNumber)
      if (uploadedDataRef.current.get(regionNumber) === data) {
        continue
      }
      uploadedDataRef.current.set(regionNumber, data)
      renderer.uploadForRegion(regionNumber, {
        regionStart: data.regionStart,
        rectPositions: data.rectPositions,
        rectYs: data.rectYs,
        rectHeights: data.rectHeights,
        rectColors: data.rectColors,
        numRects: data.numRects,
        linePositions: data.linePositions,
        lineYs: data.lineYs,
        lineColors: data.lineColors,
        lineDirections: data.lineDirections,
        numLines: data.numLines,
        arrowXs: data.arrowXs,
        arrowYs: data.arrowYs,
        arrowDirections: data.arrowDirections,
        arrowHeights: data.arrowHeights,
        arrowColors: data.arrowColors,
        numArrows: data.numArrows,
      })
    }
    // Clean up stale entries from our tracking ref
    for (const key of uploadedDataRef.current.keys()) {
      if (!activeRegions.has(key)) {
        uploadedDataRef.current.delete(key)
      }
    }
    renderer.pruneStaleRegions(activeRegions)

    scheduleRender()
  }, [rpcDataMap, scheduleRender, contextVersion])

  // Re-render when container dimensions change
  useEffect(() => {
    if (rendererReady && measuredDims.width !== undefined) {
      scheduleRender()
    }
  }, [rendererReady, measuredDims.width, measuredDims.height, scheduleRender])

  // Cleanup
  useEffect(() => {
    return () => {
      if (renderRAFRef.current) {
        cancelAnimationFrame(renderRAFRef.current)
      }
    }
  }, [])

  // Wheel handler for pan/zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      const view = viewRef.current
      if (!view.initialized) {
        return
      }

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Horizontal pan
      if (absX > 5 && absX > absY * 2) {
        e.preventDefault()
        e.stopPropagation()
        const newOffsetPx = view.offsetPx + e.deltaX

        selfUpdateRef.current = true
        view.setNewView(view.bpPerPx, newOffsetPx)

        renderWithBlocksRef.current()
        return
      }

      if (absY < 1) {
        return
      }

      // Vertical scroll (Y-axis panning)
      if (e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        const panAmount = e.deltaY * 0.5
        const newScrollY = Math.max(0, scrollYRef.current + panAmount)
        scrollYRef.current = newScrollY
        setScrollY(newScrollY)
        renderWithBlocksRef.current()
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // Mouse event handler for hit detection and tooltips
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const getMouseInfo = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const yPos = mouseY + scrollYRef.current
      return { mouseX, mouseY, yPos }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rpcDataMap = model.rpcDataMap
      if (rpcDataMap.size === 0) {
        model.setMouseoverExtraInformation(undefined)
        setHoveredFeature(null)
        setHoveredSubfeature(null)
        return
      }

      const { mouseX, yPos } = getMouseInfo(e)

      const { feature, subfeature } = performMultiRegionHitDetection(
        flatbushCacheMapRef.current,
        rpcDataMap,
        view.visibleRegions,
        mouseX,
        yPos,
      )

      if (subfeature) {
        model.setMouseoverExtraInformation(
          subfeature.tooltip ?? subfeature.type,
        )
        setHoveredFeature(feature)
        setHoveredSubfeature(subfeature)
        model.setFeatureIdUnderMouse(feature?.featureId ?? null)
      } else if (feature) {
        model.setMouseoverExtraInformation(feature.tooltip)
        setHoveredFeature(feature)
        setHoveredSubfeature(null)
        model.setFeatureIdUnderMouse(feature.featureId)
      } else {
        model.setMouseoverExtraInformation(undefined)
        setHoveredFeature(null)
        setHoveredSubfeature(null)
        model.setFeatureIdUnderMouse(null)
      }
    }

    const handleMouseLeave = () => {
      model.setMouseoverExtraInformation(undefined)
      setHoveredFeature(null)
      setHoveredSubfeature(null)
      model.setFeatureIdUnderMouse(null)
    }

    const handleClick = (e: MouseEvent) => {
      if (model.rpcDataMap.size === 0) {
        return
      }

      const { mouseX, yPos } = getMouseInfo(e)

      const { feature, subfeature } = performMultiRegionHitDetection(
        flatbushCacheMapRef.current,
        model.rpcDataMap,
        view.visibleRegions,
        mouseX,
        yPos,
      )

      if (feature) {
        model.selectFeatureById(feature, subfeature ?? undefined)
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (model.rpcDataMap.size === 0) {
        return
      }

      const { mouseX, yPos } = getMouseInfo(e)

      const { feature } = performMultiRegionHitDetection(
        flatbushCacheMapRef.current,
        model.rpcDataMap,
        view.visibleRegions,
        mouseX,
        yPos,
      )

      if (feature) {
        model.showContextMenuForFeature(feature)
      }
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('contextmenu', handleContextMenu)
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [model])

  const bpPerPx = view.bpPerPx
  const offsetPx = view.offsetPx
  const visibleRegions = view.visibleRegions

  // Compute floating label positions (multi-region aware)
  const floatingLabelElements = useMemo(() => {
    if (
      !view.initialized ||
      !width ||
      !bpPerPx ||
      visibleRegions.length === 0
    ) {
      return null
    }

    const elements: React.ReactElement[] = []

    for (const vr of visibleRegions) {
      const data = rpcDataMap.get(vr.regionNumber)
      if (!data?.floatingLabelsData) {
        continue
      }

      const regionStart = data.regionStart
      const blockBpPerPx =
        (vr.end - vr.start) / (vr.screenEndPx - vr.screenStartPx)

      for (const [featureId, labelData] of Object.entries(
        data.floatingLabelsData,
      )) {
        const featureStartBp = labelData.minX + regionStart
        const featureEndBp = labelData.maxX + regionStart

        if (featureEndBp < vr.start || featureStartBp > vr.end) {
          continue
        }

        const featureLeftPx =
          vr.screenStartPx + (featureStartBp - vr.start) / blockBpPerPx
        const featureRightPx =
          vr.screenStartPx + (featureEndBp - vr.start) / blockBpPerPx
        const featureWidth = featureRightPx - featureLeftPx

        const featureBottomPx = labelData.topY + labelData.featureHeight

        for (const [i, label] of labelData.floatingLabels.entries()) {
          const { text, relativeY, color } = label
          const labelPadding = 2
          const labelY = featureBottomPx - scrollY + relativeY + labelPadding
          const labelWidth = measureText(text, 11)

          let labelX: number
          if (labelWidth > featureWidth) {
            labelX = featureLeftPx
          } else {
            const minX = Math.max(vr.screenStartPx, featureLeftPx)
            const maxX = featureRightPx - labelWidth
            labelX = Math.min(Math.max(minX, 0), maxX)
          }

          elements.push(
            <div
              key={`${vr.regionNumber}-${featureId}-${i}`}
              style={{
                position: 'absolute',
                transform: `translate(${labelX}px, ${labelY}px)`,
                fontSize: 11,
                color,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </div>,
          )
        }
      }
    }

    return elements.length > 0 ? elements : null
  }, [rpcDataMap, view, width, bpPerPx, offsetPx, visibleRegions, scrollY])

  // Compute amino acid letter overlay (multi-region aware)
  const aminoAcidOverlayElements = useMemo(() => {
    if (
      !view.initialized ||
      !width ||
      !bpPerPx ||
      !shouldRenderPeptideText(bpPerPx) ||
      visibleRegions.length === 0
    ) {
      return null
    }

    const elements: React.ReactElement[] = []

    for (const vr of visibleRegions) {
      const data = rpcDataMap.get(vr.regionNumber)
      if (!data?.aminoAcidOverlay) {
        continue
      }

      const blockBpPerPx =
        (vr.end - vr.start) / (vr.screenEndPx - vr.screenStartPx)

      for (const [i, item] of data.aminoAcidOverlay.entries()) {
        if (item.endBp < vr.start || item.startBp > vr.end) {
          continue
        }

        const leftPx =
          vr.screenStartPx + (item.startBp - vr.start) / blockBpPerPx
        const rightPx =
          vr.screenStartPx + (item.endBp - vr.start) / blockBpPerPx
        const centerPx = (leftPx + rightPx) / 2
        const topPx = item.topPx - scrollY
        const fontSize = Math.min(item.heightPx - 2, 12)

        elements.push(
          <div
            key={`${vr.regionNumber}-${i}`}
            style={{
              position: 'absolute',
              left: centerPx,
              top: topPx,
              height: item.heightPx,
              transform: 'translateX(-50%)',
              fontSize,
              lineHeight: `${item.heightPx}px`,
              color: item.isStopOrNonTriplet ? 'red' : 'black',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {item.aminoAcid}
            {item.proteinIndex + 1}
          </div>,
        )
      }
    }

    return elements.length > 0 ? elements : null
  }, [rpcDataMap, view, width, bpPerPx, offsetPx, visibleRegions, scrollY])

  // Compute highlight overlays for hovered and selected features (multi-region aware)
  const highlightOverlays = useMemo(() => {
    if (
      !view.initialized ||
      !width ||
      !bpPerPx ||
      visibleRegions.length === 0
    ) {
      return null
    }

    const overlays: React.ReactElement[] = []

    const getItemRect = (
      item: { startBp: number; endBp: number; topPx: number; bottomPx: number },
      vr: VisibleRegion,
    ) => {
      if (item.endBp < vr.start || item.startBp > vr.end) {
        return undefined
      }
      const blockBpPerPx =
        (vr.end - vr.start) / (vr.screenEndPx - vr.screenStartPx)
      const leftPx = vr.screenStartPx + (item.startBp - vr.start) / blockBpPerPx
      const rightPx = vr.screenStartPx + (item.endBp - vr.start) / blockBpPerPx
      return {
        leftPx,
        width: rightPx - leftPx,
        topPx: item.topPx - scrollY,
        heightPx: item.bottomPx - item.topPx,
      }
    }

    const findItemForId = (featureId: string) => {
      for (const vr of visibleRegions) {
        const data = rpcDataMap.get(vr.regionNumber)
        if (data) {
          const feature = data.flatbushItems.find(
            f => f.featureId === featureId,
          )
          if (feature) {
            return { item: feature, vr, data }
          }
          const sub = data.subfeatureInfos.find(s => s.featureId === featureId)
          if (sub) {
            return { item: sub, vr, data: undefined }
          }
        }
      }
      return undefined
    }

    const addOverlay = (
      item: { startBp: number; endBp: number; topPx: number; bottomPx: number },
      style: React.CSSProperties,
      key: string,
      extraWidth = 0,
      padding = 0,
    ) => {
      for (const vr of visibleRegions) {
        const rect = getItemRect(item, vr)
        if (rect) {
          overlays.push(
            <div
              key={`${key}-${vr.regionNumber}`}
              style={{
                position: 'absolute',
                left: rect.leftPx - padding,
                top: rect.topPx - padding,
                width: rect.width + extraWidth + padding * 2,
                height: rect.heightPx + padding * 2,
                pointerEvents: 'none',
                ...style,
              }}
            />,
          )
        }
      }
    }

    const computeExtraWidth = (
      featureId: string,
      item: { startBp: number; endBp: number },
      vr: VisibleRegion,
      data: WebGLFeatureDataResult | undefined,
    ) => {
      if (!data) {
        return 0
      }
      const labelData = data.floatingLabelsData[featureId]
      if (!labelData) {
        return 0
      }
      const blockBpPerPx =
        (vr.end - vr.start) / (vr.screenEndPx - vr.screenStartPx)
      const featureWidthPx = (item.endBp - item.startBp) / blockBpPerPx
      return computeLabelExtraWidth(labelData, featureWidthPx)
    }

    const hoverItem = hoveredSubfeature ?? hoveredFeature
    if (hoverItem) {
      let hoverExtraWidth = 0
      if (hoveredFeature && !hoveredSubfeature) {
        const result = findItemForId(hoveredFeature.featureId)
        if (result?.data) {
          hoverExtraWidth = computeExtraWidth(
            hoveredFeature.featureId,
            hoverItem,
            result.vr,
            result.data,
          )
        }
      }
      addOverlay(
        hoverItem,
        { backgroundColor: 'rgba(0, 0, 0, 0.15)' },
        'hover',
        hoverExtraWidth,
      )
    }

    if (model.selectedFeatureId) {
      const result = findItemForId(model.selectedFeatureId)
      if (result) {
        const { item, data } = result
        const extraWidth = computeExtraWidth(
          model.selectedFeatureId,
          item,
          result.vr,
          data,
        )
        addOverlay(
          item,
          {
            border: '2px solid rgba(0, 100, 255, 0.8)',
            borderRadius: 3,
          },
          'selected',
          extraWidth,
          2,
        )
      }
    }

    return overlays.length > 0 ? overlays : null
  }, [
    rpcDataMap,
    view,
    width,
    bpPerPx,
    offsetPx,
    visibleRegions,
    scrollY,
    hoveredFeature,
    hoveredSubfeature,
    model.selectedFeatureId,
  ])

  if (model.regionTooLarge) {
    return <TooLargeMessage model={model} />
  }

  if (error) {
    return (
      <div style={{ color: '#c00', padding: 16 }}>Error: {error.message}</div>
    )
  }

  const isReady = width !== undefined && view.initialized

  return (
    <div
      ref={measureRef}
      style={{ position: 'relative', width: '100%', height }}
    >
      <canvas
        ref={canvasRef}
        width={width ?? 800}
        height={height}
        style={{
          display: 'block',
          width: width ?? '100%',
          height,
          cursor: hoveredFeature ? 'pointer' : 'default',
        }}
      />

      {[highlightOverlays, floatingLabelElements, aminoAcidOverlayElements].map(
        (elements, i) =>
          elements ? (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'hidden',
              }}
            >
              {elements}
            </div>
          ) : null,
      )}

      <LoadingOverlay
        statusMessage={isLoading ? 'Loading features' : 'Initializing'}
        isVisible={isLoading || !isReady}
      />
    </div>
  )
})

export default WebGLFeatureComponent
