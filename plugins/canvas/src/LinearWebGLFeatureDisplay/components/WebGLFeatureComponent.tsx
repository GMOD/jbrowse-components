import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { TooLargeMessage } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { CanvasFeatureRenderer } from './CanvasFeatureRenderer.ts'
import { computeLabelExtraWidth } from './highlightUtils.ts'
import { shouldRenderPeptideText } from '../../RenderWebGLFeatureDataRPC/zoomThresholds.ts'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'

import type { FeatureRenderBlock } from './CanvasFeatureRenderer.ts'
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
) {
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
) {
  let feature: FlatbushItem | null = null
  let subfeature: SubfeatureInfo | null = null

  const { featureIndex, subfeatureIndex } = getOrCreateFlatbushIndexes(
    cache,
    flatbushData,
    subfeatureFlatbushData,
  )

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
  const scrollbarHostRef = useRef<HTMLDivElement>(null)
  const selfUpdateRef = useRef(false)

  const view = getContainingView(model) as LGV

  const { rpcDataMap, isLoading, error } = model

  const width = view.initialized ? view.width : undefined
  const height = model.height

  const rendererRef = useRef<CanvasFeatureRenderer | null>(null)

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
      canvasHeight: model.height,
    })
  }, [view, width, model])

  const renderWithBlocksRef = useRef(renderWithBlocks)
  renderWithBlocksRef.current = renderWithBlocks
  const viewRef = useRef(view)
  viewRef.current = view

  const canvasCallbackRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      if (rendererRef.current) {
        rendererRef.current.onDeviceLost = null
      }
      return
    }
    canvasRef.current = canvas
    const renderer = CanvasFeatureRenderer.getOrCreate(canvas)
    rendererRef.current = renderer

    const doInit = () => {
      renderer
        .init()
        .then(ok => {
          if (!ok) {
            console.error('[WebGLFeatureComponent] GPU initialization failed')
          }
          setRendererReady(ok)
          uploadedDataRef.current.clear()
        })
        .catch((e: unknown) => {
          console.error('[WebGLFeatureComponent] GPU initialization error:', e)
          setRendererReady(false)
        })
    }

    renderer.onDeviceLost = () => {
      setRendererReady(false)
      uploadedDataRef.current.clear()
      doInit()
    }

    doInit()
  }, [])

  useEffect(() => {
    const dispose = autorun(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { offsetPx: _op, bpPerPx: _bpp, initialized, width: _w } = view
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _h = model.height

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

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !rendererReady) {
      return
    }

    if (rpcDataMap.size === 0) {
      renderer.pruneStaleRegions([])
      uploadedDataRef.current.clear()
      scrollYRef.current = 0
      setScrollY(0)
      if (scrollbarHostRef.current) {
        scrollbarHostRef.current.scrollTop = 0
      }
      return
    }

    const activeRegions = new Set<number>()
    for (const [regionNumber, data] of rpcDataMap) {
      activeRegions.add(regionNumber)
      if (uploadedDataRef.current.get(regionNumber) === data) {
        continue
      }
      uploadedDataRef.current.set(regionNumber, data)
      renderer.uploadRegion(regionNumber, {
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
    for (const key of uploadedDataRef.current.keys()) {
      if (!activeRegions.has(key)) {
        uploadedDataRef.current.delete(key)
      }
    }
    renderer.pruneStaleRegions([...activeRegions])

    renderWithBlocksRef.current()
  }, [rpcDataMap, rendererReady])

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

      if (absX > 5 && absX > absY * 2) {
        e.preventDefault()
        e.stopPropagation()
        selfUpdateRef.current = true
        view.setNewView(view.bpPerPx, view.offsetPx + e.deltaX)
        renderWithBlocksRef.current()
        return
      }

      if (absY < 1 || view.scrollZoom) {
        return
      }

      e.preventDefault()
      e.stopPropagation()
      const maxScrollY = Math.max(0, model.maxY - model.height)
      const newScrollY = Math.max(
        0,
        Math.min(scrollYRef.current + e.deltaY * 0.5, maxScrollY),
      )
      scrollYRef.current = newScrollY
      setScrollY(newScrollY)
      if (scrollbarHostRef.current) {
        scrollbarHostRef.current.scrollTop = newScrollY
      }
      renderWithBlocksRef.current()
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])

  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions

  const featureItemMap = useMemo(() => {
    const map = new Map<
      string,
      {
        item: FlatbushItem | SubfeatureInfo
        vr: VisibleRegion
        data: WebGLFeatureDataResult | undefined
      }
    >()
    for (const vr of visibleRegions) {
      const data = rpcDataMap.get(vr.regionNumber)
      if (data) {
        for (const f of data.flatbushItems) {
          map.set(f.featureId, { item: f, vr, data })
        }
        for (const s of data.subfeatureInfos) {
          if (!map.has(s.featureId)) {
            map.set(s.featureId, { item: s, vr, data: undefined })
          }
        }
      }
    }
    return map
  }, [rpcDataMap, visibleRegions])

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
          const { text, relativeY, color, textWidth: labelWidth } = label
          const labelPadding = 2
          const labelY = featureBottomPx + relativeY + labelPadding

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
  }, [rpcDataMap, view, width, bpPerPx, visibleRegions])

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
        const topPx = item.topPx
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
  }, [rpcDataMap, view, width, bpPerPx, visibleRegions])

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
        topPx: item.topPx,
        heightPx: item.bottomPx - item.topPx,
      }
    }

    const findItemForId = (featureId: string) => featureItemMap.get(featureId)

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
    featureItemMap,
    rpcDataMap,
    view,
    width,
    bpPerPx,
    visibleRegions,
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

  const isReady = view.initialized

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      <canvas
        ref={canvasCallbackRef}
        style={{
          display: 'block',
          width,
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
                transform: `translateY(-${scrollY}px)`,
              }}
            >
              {elements}
            </div>
          ) : null,
      )}

      {model.maxY > height ? (
        <div
          ref={scrollbarHostRef}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 14,
            height: '100%',
            overflowY: 'scroll',
          }}
          onScroll={e => {
            const st = e.currentTarget.scrollTop
            scrollYRef.current = st
            setScrollY(st)
            renderWithBlocksRef.current()
          }}
        >
          <div style={{ height: model.maxY }} />
        </div>
      ) : null}

      <LoadingOverlay
        statusMessage={isLoading ? 'Loading features' : 'Initializing'}
        isVisible={isLoading || !isReady}
      />
    </div>
  )
})

export default WebGLFeatureComponent
