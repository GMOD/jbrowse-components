import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getContainingView, measureText } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { WebGLFeatureRenderer } from './WebGLFeatureRenderer.ts'

import type {
  FlatbushItem,
  FloatingLabelsDataMap,
  SubfeatureInfo,
  WebGLFeatureDataResult,
} from '../../RenderWebGLFeatureDataRPC/types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface LinearWebGLFeatureDisplayModel {
  height: number
  rpcData: WebGLFeatureDataResult | null
  loadedRegion: { refName: string; start: number; end: number } | null
  isLoading: boolean
  error: Error | null
  maxY: number
  selectedFeatureId: string | undefined // from base class computed
  featureIdUnderMouse: string | null
  setMaxY: (y: number) => void
  setCurrentDomain: (domain: [number, number]) => void
  handleNeedMoreData: (region: { start: number; end: number }) => void
  setFeatureIdUnderMouse: (featureId: string | null) => void
  selectFeatureById: (
    featureInfo: FlatbushItem,
    subfeatureInfo?: SubfeatureInfo,
  ) => void
  showContextMenuForFeature: (featureInfo: FlatbushItem) => void
  getFeatureById: (featureId: string) => FlatbushItem | undefined
}

interface TooltipState {
  x: number
  y: number
  text: string
}

export interface Props {
  model: LinearWebGLFeatureDisplayModel
}

// Cache for reconstructed Flatbush indexes
interface FlatbushCache {
  featureIndex: Flatbush | null
  subfeatureIndex: Flatbush | null
  flatbushData: ArrayBuffer | null
  subfeatureFlatbushData: ArrayBuffer | null
}

function getOrCreateFlatbushIndexes(
  cache: FlatbushCache,
  flatbushData: ArrayBuffer,
  subfeatureFlatbushData: ArrayBuffer,
): { featureIndex: Flatbush | null; subfeatureIndex: Flatbush | null } {
  // Check if we need to rebuild feature index
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

  // Check if we need to rebuild subfeature index
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

// Helper to perform hit detection
function performHitDetection(
  cache: FlatbushCache,
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

const WebGLFeatureComponent = observer(function WebGLFeatureComponent({
  model,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<WebGLFeatureRenderer | null>(null)
  const [measureRef, measuredDims] = useMeasure()
  const [rendererReady, setRendererReady] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [hoveredFeature, setHoveredFeature] = useState<FlatbushItem | null>(
    null,
  )
  const [hoveredSubfeature, setHoveredSubfeature] =
    useState<SubfeatureInfo | null>(null)
  const [scrollY, setScrollY] = useState(0)
  const flatbushCacheRef = useRef<FlatbushCache>({
    featureIndex: null,
    subfeatureIndex: null,
    flatbushData: null,
    subfeatureFlatbushData: null,
  })

  const scrollYRef = useRef(0)
  const renderRAFRef = useRef<number | null>(null)
  const selfUpdateRef = useRef(false)
  const pendingDataRequestRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const lastRequestedRegionRef = useRef<{ start: number; end: number } | null>(
    null,
  )

  const view = getContainingView(model) as LinearGenomeViewModel | undefined

  const { rpcData, isLoading, error } = model

  const width =
    measuredDims.width ?? (view?.initialized ? view.width : undefined)
  const height = model.height

  const getVisibleBpRange = useCallback((): [number, number] | null => {
    if (!view?.initialized || width === undefined) {
      return null
    }

    const dynamicBlocks = (
      view as unknown as {
        dynamicBlocks?: {
          contentBlocks?: {
            refName: string
            start: number
            end: number
            offsetPx?: number
          }[]
        }
      }
    ).dynamicBlocks
    const contentBlocks = dynamicBlocks?.contentBlocks
    if (!contentBlocks || contentBlocks.length === 0) {
      return null
    }
    const first = contentBlocks[0]
    const last = contentBlocks[contentBlocks.length - 1]
    if (!first || first.refName !== last?.refName) {
      return null
    }

    const bpPerPx = view.bpPerPx
    const blockOffsetPx = first.offsetPx ?? 0
    const deltaPx = view.offsetPx - blockOffsetPx
    const deltaBp = deltaPx * bpPerPx

    const rangeStart = first.start + deltaBp
    const rangeEnd = rangeStart + width * bpPerPx
    return [rangeStart, rangeEnd]
  }, [view, width])

  const renderWithDomain = useCallback(
    (domainX: [number, number], canvasW?: number) => {
      const w = canvasW ?? width
      if (!rendererRef.current || w === undefined) {
        return
      }

      rendererRef.current.render({
        domainX,
        scrollY: scrollYRef.current,
        canvasWidth: w,
        canvasHeight: height,
      })
    },
    [width, height],
  )

  const renderNow = useCallback(() => {
    const visibleBpRange = getVisibleBpRange()
    if (!visibleBpRange) {
      return
    }
    renderWithDomain(visibleBpRange)
  }, [getVisibleBpRange, renderWithDomain])

  const scheduleRender = useCallback(() => {
    if (renderRAFRef.current !== null) {
      cancelAnimationFrame(renderRAFRef.current)
    }
    renderRAFRef.current = requestAnimationFrame(() => {
      renderRAFRef.current = null
      renderNow()
    })
  }, [renderNow])

  const checkDataNeeds = useCallback(() => {
    const visibleBpRange = getVisibleBpRange()
    if (!visibleBpRange) {
      return
    }
    const loadedRegion = model.loadedRegion
    if (!loadedRegion || model.isLoading) {
      return
    }

    const buffer = (visibleBpRange[1] - visibleBpRange[0]) * 0.5
    const needsData =
      visibleBpRange[0] - buffer < loadedRegion.start ||
      visibleBpRange[1] + buffer > loadedRegion.end

    if (needsData) {
      if (pendingDataRequestRef.current) {
        clearTimeout(pendingDataRequestRef.current)
      }
      pendingDataRequestRef.current = setTimeout(() => {
        if (model.isLoading) {
          return
        }
        const currentRange = getVisibleBpRange()
        if (!currentRange) {
          return
        }
        const requested = lastRequestedRegionRef.current
        if (
          requested &&
          currentRange[0] >= requested.start &&
          currentRange[1] <= requested.end
        ) {
          return
        }
        lastRequestedRegionRef.current = {
          start: currentRange[0],
          end: currentRange[1],
        }
        model.handleNeedMoreData({
          start: currentRange[0],
          end: currentRange[1],
        })
        pendingDataRequestRef.current = null
      }, 200)
    }
  }, [getVisibleBpRange, model])

  const renderNowRef = useRef(renderNow)
  renderNowRef.current = renderNow
  const renderWithDomainRef = useRef(renderWithDomain)
  renderWithDomainRef.current = renderWithDomain
  const checkDataNeedsRef = useRef(checkDataNeeds)
  checkDataNeedsRef.current = checkDataNeeds
  const getVisibleBpRangeRef = useRef(getVisibleBpRange)
  getVisibleBpRangeRef.current = getVisibleBpRange
  const viewRef = useRef(view)
  viewRef.current = view
  const widthRef = useRef(width)
  widthRef.current = width

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    try {
      rendererRef.current = new WebGLFeatureRenderer(canvas)
      setRendererReady(true)
    } catch (e) {
      console.error('Failed to initialize WebGL:', e)
    }
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
      setRendererReady(false)
    }
  }, [])

  // Re-render when view state changes
  useEffect(() => {
    if (!view) {
      return
    }

    const dispose = autorun(() => {
      try {
        // Access observables to subscribe
        const _offsetPx = view.offsetPx
        const _bpPerPx = view.bpPerPx
        const initialized = view.initialized

        if (selfUpdateRef.current) {
          selfUpdateRef.current = false
          return
        }

        if (!initialized) {
          return
        }

        const visibleBpRange = getVisibleBpRangeRef.current()
        if (visibleBpRange) {
          model.setCurrentDomain(visibleBpRange)
        }

        renderNowRef.current()
      } catch {
        // Model may have been detached from state tree
      }
    })

    return () => {
      dispose()
    }
  }, [view, model])

  // Upload features to GPU from RPC typed arrays
  useEffect(() => {
    if (!rendererRef.current || !rpcData || rpcData.numRects === 0) {
      return
    }

    rendererRef.current.uploadFromTypedArrays({
      regionStart: rpcData.regionStart,
      rectPositions: rpcData.rectPositions,
      rectYs: rpcData.rectYs,
      rectHeights: rpcData.rectHeights,
      rectColors: rpcData.rectColors,
      numRects: rpcData.numRects,
      linePositions: rpcData.linePositions,
      lineYs: rpcData.lineYs,
      lineColors: rpcData.lineColors,
      lineDirections: rpcData.lineDirections,
      numLines: rpcData.numLines,
      arrowXs: rpcData.arrowXs,
      arrowYs: rpcData.arrowYs,
      arrowDirections: rpcData.arrowDirections,
      arrowHeights: rpcData.arrowHeights,
      arrowColors: rpcData.arrowColors,
      numArrows: rpcData.numArrows,
    })
    model.setMaxY(rpcData.maxY)

    scheduleRender()
  }, [rpcData, model, scheduleRender])

  // Re-render when container dimensions change
  useEffect(() => {
    if (rendererReady && measuredDims.width !== undefined) {
      scheduleRender()
    }
  }, [rendererReady, measuredDims.width, measuredDims.height, scheduleRender])

  // Reset data request tracking
  useEffect(() => {
    lastRequestedRegionRef.current = null
  }, [model.loadedRegion])

  // Cleanup
  useEffect(() => {
    return () => {
      if (pendingDataRequestRef.current) {
        clearTimeout(pendingDataRequestRef.current)
      }
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
      const width = widthRef.current

      if (!view?.initialized || width === undefined) {
        return
      }

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      // Horizontal pan
      if (absX > 5 && absX > absY * 2) {
        e.preventDefault()
        e.stopPropagation()
        const newOffsetPx = view.offsetPx + e.deltaX

        const dynamicBlocks = (
          view as unknown as {
            dynamicBlocks?: {
              contentBlocks?: {
                refName: string
                start: number
                end: number
                offsetPx?: number
              }[]
            }
          }
        ).dynamicBlocks?.contentBlocks
        const first = dynamicBlocks?.[0]
        if (first) {
          const blockOffsetPx = first.offsetPx ?? 0
          const deltaPx = newOffsetPx - blockOffsetPx
          const deltaBp = deltaPx * view.bpPerPx
          const rangeStart = first.start + deltaBp
          const rangeEnd = rangeStart + width * view.bpPerPx

          renderWithDomainRef.current([rangeStart, rangeEnd])
          selfUpdateRef.current = true
          view.setNewView(view.bpPerPx, newOffsetPx)
        }

        checkDataNeedsRef.current()
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
        // Update state to trigger floating labels re-render
        setScrollY(newScrollY)
        renderNowRef.current()
      } else if (view.scrollZoom || e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()
        // Zoom
        const currentRange = getVisibleBpRangeRef.current()
        if (!currentRange) {
          return
        }

        const rect = canvas.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const factor = 1.2
        const zoomFactor = e.deltaY > 0 ? factor : 1 / factor

        const rangeWidth = currentRange[1] - currentRange[0]
        const mouseFraction = mouseX / width
        const mouseBp = currentRange[0] + rangeWidth * mouseFraction

        const newRangeWidth = rangeWidth * zoomFactor
        const newBpPerPx = newRangeWidth / width

        if (newBpPerPx < view.minBpPerPx || newBpPerPx > view.maxBpPerPx) {
          return
        }

        const newRangeStart = mouseBp - mouseFraction * newRangeWidth
        const newRangeEnd = newRangeStart + newRangeWidth

        const dynamicBlocks = (
          view as unknown as {
            dynamicBlocks?: {
              contentBlocks?: {
                refName: string
                start: number
                end: number
                offsetPx?: number
              }[]
            }
          }
        ).dynamicBlocks?.contentBlocks
        const first = dynamicBlocks?.[0]
        if (first) {
          const blockOffsetPx = first.offsetPx ?? 0
          const assemblyOrigin = first.start - blockOffsetPx * view.bpPerPx
          const newOffsetPx = (newRangeStart - assemblyOrigin) / newBpPerPx

          renderWithDomainRef.current([newRangeStart, newRangeEnd])
          selfUpdateRef.current = true
          view.setNewView(newBpPerPx, newOffsetPx)
        }

        checkDataNeedsRef.current()
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

    const getMouseBpAndY = (
      e: MouseEvent,
    ): { bpPos: number; yPos: number } | null => {
      const view = viewRef.current
      const w = widthRef.current
      if (!view?.initialized || w === undefined) {
        return null
      }

      const visibleRange = getVisibleBpRangeRef.current()
      if (!visibleRange) {
        return null
      }

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const rangeWidth = visibleRange[1] - visibleRange[0]
      const bpPos = visibleRange[0] + (mouseX / w) * rangeWidth
      const yPos = mouseY + scrollYRef.current

      return { bpPos, yPos }
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rpcData = model.rpcData
      if (!rpcData) {
        setTooltip(null)
        setHoveredFeature(null)
        setHoveredSubfeature(null)
        return
      }

      const pos = getMouseBpAndY(e)
      if (!pos) {
        setTooltip(null)
        setHoveredFeature(null)
        setHoveredSubfeature(null)
        return
      }

      const { feature, subfeature } = performHitDetection(
        flatbushCacheRef.current,
        rpcData.flatbushData,
        rpcData.flatbushItems,
        rpcData.subfeatureFlatbushData,
        rpcData.subfeatureInfos,
        pos.bpPos,
        pos.yPos,
      )

      if (subfeature) {
        // Hovering over a transcript - show transcript tooltip, highlight transcript only
        const rect = canvas.getBoundingClientRect()
        setTooltip({
          x: e.clientX - rect.left + 10,
          y: e.clientY - rect.top + 10,
          text: subfeature.tooltip ?? subfeature.type,
        })
        setHoveredFeature(feature)
        setHoveredSubfeature(subfeature)
        model.setFeatureIdUnderMouse(feature?.featureId ?? null)
      } else if (feature) {
        // Hovering over gene (but not a specific transcript) - show gene tooltip, highlight gene
        const rect = canvas.getBoundingClientRect()
        setTooltip({
          x: e.clientX - rect.left + 10,
          y: e.clientY - rect.top + 10,
          text: feature.tooltip,
        })
        setHoveredFeature(feature)
        setHoveredSubfeature(null)
        model.setFeatureIdUnderMouse(feature.featureId)
      } else {
        setTooltip(null)
        setHoveredFeature(null)
        setHoveredSubfeature(null)
        model.setFeatureIdUnderMouse(null)
      }
    }

    const handleMouseLeave = () => {
      setTooltip(null)
      setHoveredFeature(null)
      setHoveredSubfeature(null)
      model.setFeatureIdUnderMouse(null)
    }

    const handleClick = (e: MouseEvent) => {
      const rpcData = model.rpcData
      if (!rpcData) {
        return
      }

      const pos = getMouseBpAndY(e)
      if (!pos) {
        return
      }

      const { feature, subfeature } = performHitDetection(
        flatbushCacheRef.current,
        rpcData.flatbushData,
        rpcData.flatbushItems,
        rpcData.subfeatureFlatbushData,
        rpcData.subfeatureInfos,
        pos.bpPos,
        pos.yPos,
      )

      if (feature) {
        model.selectFeatureById(feature, subfeature ?? undefined)
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const rpcData = model.rpcData
      if (!rpcData) {
        return
      }

      const pos = getMouseBpAndY(e)
      if (!pos) {
        return
      }

      const { feature } = performHitDetection(
        flatbushCacheRef.current,
        rpcData.flatbushData,
        rpcData.flatbushItems,
        rpcData.subfeatureFlatbushData,
        rpcData.subfeatureInfos,
        pos.bpPos,
        pos.yPos,
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
  }, [model, model.rpcData])

  // Compute floating label positions
  // Need to include view.bpPerPx and view.offsetPx in deps so labels update on pan/zoom
  const bpPerPx = view?.bpPerPx
  const viewOffsetPx = view?.offsetPx

  const floatingLabelElements = useMemo(() => {
    if (
      !rpcData?.floatingLabelsData ||
      !view?.initialized ||
      !width ||
      !bpPerPx
    ) {
      return null
    }

    const regionStart = rpcData.regionStart
    const visibleRange = getVisibleBpRange()
    if (!visibleRange) {
      return null
    }

    const elements: React.ReactElement[] = []

    for (const [featureId, labelData] of Object.entries(
      rpcData.floatingLabelsData,
    )) {
      const featureStartBp = labelData.minX + regionStart
      const featureEndBp = labelData.maxX + regionStart

      // Check if feature is in visible range
      if (featureEndBp < visibleRange[0] || featureStartBp > visibleRange[1]) {
        continue
      }

      const featureLeftPx = (featureStartBp - visibleRange[0]) / bpPerPx
      const featureRightPx = (featureEndBp - visibleRange[0]) / bpPerPx
      const featureWidth = featureRightPx - featureLeftPx

      // Use labelData for visual positioning (not flatbushItem which includes hit box padding)
      const featureBottomPx = labelData.topY + labelData.featureHeight

      for (const [i, label] of labelData.floatingLabels.entries()) {
        const { text, relativeY, color } = label
        const labelPadding = 2 // Small gap between feature and label
        const labelY = featureBottomPx - scrollY + relativeY + labelPadding
        const labelWidth = measureText(text, 11)

        // Calculate floating position (clamped to feature bounds and viewport)
        let labelX: number
        if (labelWidth > featureWidth) {
          // Label wider than feature - anchor to feature left
          labelX = featureLeftPx
        } else {
          // Float within feature bounds, clamped to viewport
          // Label should stay visible (not go off left edge of viewport)
          // but also not extend past the feature's right edge
          const minX = Math.max(0, featureLeftPx)
          const maxX = featureRightPx - labelWidth
          labelX = Math.min(Math.max(minX, 0), maxX)
        }

        elements.push(
          <div
            key={`${featureId}-${i}`}
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

    return elements.length > 0 ? elements : null
  }, [rpcData, view, width, bpPerPx, viewOffsetPx, getVisibleBpRange, scrollY])

  // Compute highlight overlays for hovered and selected features
  const highlightOverlays = useMemo(() => {
    if (!rpcData || !view?.initialized || !width || !bpPerPx) {
      return null
    }

    const visibleRange = getVisibleBpRange()
    if (!visibleRange) {
      return null
    }

    const overlays: React.ReactElement[] = []

    // Helper to add overlay for a gene (top-level feature)
    const addFeatureOverlay = (
      featureId: string,
      color: string,
      key: string,
    ) => {
      const feature = rpcData.flatbushItems.find(f => f.featureId === featureId)
      if (!feature) {
        return
      }

      // Check if feature is in visible range
      if (
        feature.endBp < visibleRange[0] ||
        feature.startBp > visibleRange[1]
      ) {
        return
      }

      const leftPx = (feature.startBp - visibleRange[0]) / bpPerPx
      const rightPx = (feature.endBp - visibleRange[0]) / bpPerPx
      const featureWidth = rightPx - leftPx
      const topPx = feature.topPx - scrollY
      const heightPx = feature.bottomPx - feature.topPx

      overlays.push(
        <div
          key={key}
          style={{
            position: 'absolute',
            left: leftPx,
            top: topPx,
            width: featureWidth,
            height: heightPx,
            backgroundColor: color,
            pointerEvents: 'none',
          }}
        />,
      )
    }

    // Helper to add overlay for a subfeature (transcript)
    const addSubfeatureOverlay = (
      subfeature: SubfeatureInfo,
      color: string,
      key: string,
    ) => {
      // Check if subfeature is in visible range
      if (
        subfeature.endBp < visibleRange[0] ||
        subfeature.startBp > visibleRange[1]
      ) {
        return
      }

      const leftPx = (subfeature.startBp - visibleRange[0]) / bpPerPx
      const rightPx = (subfeature.endBp - visibleRange[0]) / bpPerPx
      const featureWidth = rightPx - leftPx
      const topPx = subfeature.topPx - scrollY
      const heightPx = subfeature.bottomPx - subfeature.topPx

      overlays.push(
        <div
          key={key}
          style={{
            position: 'absolute',
            left: leftPx,
            top: topPx,
            width: featureWidth,
            height: heightPx,
            backgroundColor: color,
            pointerEvents: 'none',
          }}
        />,
      )
    }

    // Add hover highlight
    if (hoveredSubfeature) {
      // Hovering over a transcript - highlight just the transcript
      addSubfeatureOverlay(hoveredSubfeature, 'rgba(0, 0, 0, 0.15)', 'hover')
    } else if (hoveredFeature) {
      // Hovering over gene but not a specific transcript - highlight the gene
      addFeatureOverlay(
        hoveredFeature.featureId,
        'rgba(0, 0, 0, 0.15)',
        'hover',
      )
    }

    // Add selection highlight (blue tint)
    if (
      model.selectedFeatureId &&
      model.selectedFeatureId !== hoveredFeature?.featureId &&
      model.selectedFeatureId !== hoveredSubfeature?.featureId
    ) {
      addFeatureOverlay(
        model.selectedFeatureId,
        'rgba(0, 100, 255, 0.2)',
        'selected',
      )
    }

    return overlays.length > 0 ? overlays : null
  }, [
    rpcData,
    view,
    width,
    bpPerPx,
    viewOffsetPx,
    getVisibleBpRange,
    scrollY,
    hoveredFeature,
    hoveredSubfeature,
    model.selectedFeatureId,
  ])

  if (error) {
    return (
      <div style={{ color: '#c00', padding: 16 }}>Error: {error.message}</div>
    )
  }

  const visibleBpRange = getVisibleBpRange()
  const isReady = width !== undefined && visibleBpRange !== null

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

      {/* Feature highlight overlays */}
      {highlightOverlays && (
        <div
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
          {highlightOverlays}
        </div>
      )}

      {/* Floating labels overlay */}
      {floatingLabelElements && (
        <div
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
          {floatingLabelElements}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 10,
            maxWidth: 300,
            whiteSpace: 'pre-wrap',
          }}
        >
          {tooltip.text}
        </div>
      )}

      {(isLoading || !isReady) && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,255,255,0.9)',
            padding: '8px 16px',
            borderRadius: 4,
          }}
        >
          {isLoading ? 'Loading features...' : 'Initializing...'}
        </div>
      )}
    </div>
  )
})

export default WebGLFeatureComponent
