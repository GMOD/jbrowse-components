import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { ErrorOverlay, Menu } from '@jbrowse/core/ui'
import { getContainingView, useDebounce } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { TooLargeMessage } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { CanvasFeatureRenderer } from './CanvasFeatureRenderer.ts'
import FeatureTooltip from './FeatureTooltip.tsx'
import OverflowIndicator from './OverflowIndicator.tsx'
import { computeLabelExtraWidth } from './highlightUtils.ts'
import { maxLabelTextWidth } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import { shouldRenderPeptideText } from '../../RenderFeatureDataRPC/zoomThresholds.ts'
import LoadingOverlay from '../../shared/LoadingOverlay.tsx'

import type { FeatureRenderBlock } from './canvasFeatureBackendTypes.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
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

interface LinearFeatureDisplayModel {
  height: number
  rpcDataMap: Map<number, FeatureDataResult>
  visibleRegions: VisibleRegion[]
  isLoading: boolean
  error: Error | null
  maxY: number
  hasOverflow: boolean
  heightBeforeExpand: number | undefined
  showLabels: boolean
  selectedFeatureId: string | undefined
  featureIdUnderMouse: string | null
  effectiveShowDescriptions: boolean
  regionTooLarge: boolean
  regionTooLargeReason: string
  featureDensityStats?: { bytes?: number }
  statusMessage: string | undefined
  setFeatureDensityStatsLimit: (s?: { bytes?: number }) => void
  reload: () => void
  expandToFit: () => void
  collapseFromExpand: () => void
  setFeatureIdUnderMouse: (featureId: string | null) => void
  mouseoverExtraInformation: string | undefined
  setMouseoverExtraInformation: (info: string | undefined) => void
  selectFeatureById: (
    featureInfo: FlatbushItem,
    subfeatureInfo: SubfeatureInfo | undefined,
    regionNumber: number,
  ) => void
  showContextMenuForFeature: (
    featureInfo: FlatbushItem,
    regionNumber: number,
  ) => void
  setContextMenuInfo: (info?: unknown) => void
  contextMenuItems: () => { label: string; onClick: () => void }[]
  getFeatureById: (featureId: string) => FlatbushItem | undefined
}

export interface Props {
  model: LinearFeatureDisplayModel
}

interface FlatbushRegionCache {
  featureIndex: Flatbush | null
  subfeatureIndex: Flatbush | null
  cachedItems: FlatbushItem[] | null
  cachedSubInfos: SubfeatureInfo[] | null
  cachedShowDescriptions?: boolean
}

function buildFeatureIndex(
  items: FlatbushItem[],
  floatingLabelsData: FeatureDataResult['floatingLabelsData'],
  bpPerPx: number,
  reversed: boolean,
  showDescriptions: boolean,
) {
  const index = new Flatbush(items.length)
  for (const item of items) {
    let hitStartBp = item.startBp
    let hitEndBp = item.endBp
    const labelData = floatingLabelsData[item.featureId]
    if (labelData) {
      const maxLabelWidthPx = maxLabelTextWidth(labelData, showDescriptions)
      const featureWidthPx = (item.endBp - item.startBp) / bpPerPx
      if (maxLabelWidthPx > featureWidthPx) {
        const extraBp = (maxLabelWidthPx - featureWidthPx) * bpPerPx
        if (reversed) {
          hitStartBp -= extraBp
        } else {
          hitEndBp += extraBp
        }
      }
    }
    index.add(hitStartBp, item.topPx, hitEndBp, item.bottomPx)
  }
  index.finish()
  return index
}

function buildSubfeatureIndex(infos: SubfeatureInfo[]) {
  const index = new Flatbush(infos.length)
  for (const item of infos) {
    index.add(item.startBp, item.topPx, item.endBp, item.bottomPx)
  }
  index.finish()
  return index
}

function getOrCreateFlatbushIndexes(
  cache: FlatbushRegionCache,
  data: FeatureDataResult,
  bpPerPx: number,
  reversed: boolean,
  showDescriptions: boolean,
) {
  if (
    cache.cachedItems !== data.flatbushItems ||
    cache.cachedShowDescriptions !== showDescriptions
  ) {
    cache.cachedItems = data.flatbushItems
    cache.cachedShowDescriptions = showDescriptions
    cache.featureIndex =
      data.flatbushItems.length > 0
        ? buildFeatureIndex(
            data.flatbushItems,
            data.floatingLabelsData,
            bpPerPx,
            reversed,
            showDescriptions,
          )
        : null
  }

  if (cache.cachedSubInfos !== data.subfeatureInfos) {
    cache.cachedSubInfos = data.subfeatureInfos
    cache.subfeatureIndex =
      data.subfeatureInfos.length > 0
        ? buildSubfeatureIndex(data.subfeatureInfos)
        : null
  }

  return {
    featureIndex: cache.featureIndex,
    subfeatureIndex: cache.subfeatureIndex,
  }
}

function performHitDetection(
  cache: FlatbushRegionCache,
  data: FeatureDataResult,
  bpPerPx: number,
  reversed: boolean,
  bpPos: number,
  yPos: number,
  showDescriptions: boolean,
) {
  let feature: FlatbushItem | null = null
  let subfeature: SubfeatureInfo | null = null

  const { featureIndex, subfeatureIndex } = getOrCreateFlatbushIndexes(
    cache,
    data,
    bpPerPx,
    reversed,
    showDescriptions,
  )

  if (subfeatureIndex) {
    const subHits = subfeatureIndex.search(bpPos, yPos, bpPos, yPos)
    for (const idx of subHits) {
      const info = data.subfeatureInfos[idx]
      if (info) {
        subfeature = info
        break
      }
    }
  }

  if (featureIndex) {
    const hits = featureIndex.search(bpPos, yPos, bpPos, yPos)
    for (const idx of hits) {
      const item = data.flatbushItems[idx]
      if (item) {
        feature = item
        break
      }
    }
  }

  return { feature, subfeature }
}

type HitResult =
  | { feature: null; subfeature: null }
  | {
      feature: FlatbushItem
      subfeature: SubfeatureInfo | null
      regionNumber: number
    }

function performMultiRegionHitDetection(
  cacheMap: Map<number, FlatbushRegionCache>,
  rpcDataMap: Map<number, FeatureDataResult>,
  visibleRegions: VisibleRegion[],
  mouseXPx: number,
  yPos: number,
  showDescriptions: boolean,
): HitResult {
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
        cachedItems: null,
        cachedSubInfos: null,
      }
      cacheMap.set(vr.regionNumber, cache)
    }

    const blockWidth = vr.screenEndPx - vr.screenStartPx
    const bpPerPx = (vr.end - vr.start) / blockWidth
    const reversed = vr.start > vr.end
    const bpPos = vr.start + (mouseXPx - vr.screenStartPx) * bpPerPx

    const { feature, subfeature } = performHitDetection(
      cache,
      data,
      bpPerPx,
      reversed,
      bpPos,
      yPos,
      showDescriptions,
    )

    if (feature) {
      return { feature, subfeature, regionNumber: vr.regionNumber }
    }
    return { feature: null, subfeature: null }
  }
  return { feature: null, subfeature: null }
}

const ContextMenu = observer(function ContextMenu({
  model,
  contextCoord,
  onClose,
}: {
  model: LinearFeatureDisplayModel
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rendererReady, setRendererReady] = useState(false)
  const [hoveredFeature, setHoveredFeature] = useState<FlatbushItem | null>(
    null,
  )
  const [hoveredSubfeature, setHoveredSubfeature] =
    useState<SubfeatureInfo | null>(null)
  const coord0: [number, number] = [0, 0]
  const [clientXY, setClientXY] = useState(coord0)
  const [contextMenuCoord, setContextMenuCoord] = useState<
    [number, number] | undefined
  >()
  const flatbushCacheMapRef = useRef(new Map<number, FlatbushRegionCache>())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const view = getContainingView(model) as LGV

  const { rpcDataMap, isLoading, error } = model
  const debouncedLoading = useDebounce(isLoading, 500)

  const width = view.initialized ? view.trackWidthPx : undefined
  const height = model.height

  const rendererRef = useRef<CanvasFeatureRenderer | null>(null)

  const renderWithBlocks = useEffectEvent(() => {
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
        reversed: vr.reversed ?? false,
      })
    }

    renderer.renderBlocks(blocks, {
      scrollY: scrollContainerRef.current?.scrollTop ?? 0,
      canvasWidth: view.trackWidthPx,
      canvasHeight: model.height,
    })
  })

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
            console.error('[FeatureComponent] GPU initialization failed')
          }
          setRendererReady(ok)
          // GPU context lost/reset — data will be re-uploaded
          // automatically when the useLayoutEffect next fires
        })
        .catch((e: unknown) => {
          console.error('[FeatureComponent] GPU initialization error:', e)
          setRendererReady(false)
        })
    }

    renderer.onDeviceLost = () => {
      setRendererReady(false)
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

        if (!initialized) {
          return
        }

        renderWithBlocks()
      } catch {
        // Model may have been detached from state tree
      }
    })

    return () => {
      dispose()
    }
  }, [view, model])

  // useLayoutEffect ensures GPU data is uploaded before paint, keeping
  // WebGL features in sync with the DOM label overlay (which is computed
  // during the same render via useMemo). useEffect would run after paint,
  // causing a frame where labels show new data but WebGL shows old data.

  useLayoutEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !rendererReady) {
      return
    }

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }

    if (rpcDataMap.size === 0) {
      renderer.pruneStaleRegions([])
      flatbushCacheMapRef.current.clear()
      return
    }

    // DO NOT use an identity check (prevData === data) to skip uploads.
    //
    // relayoutForCurrentZoom() mutates data.rectYs and
    // data.floatingLabelsData[].topY IN PLACE when the user zooms,
    // then calls setRpcDataMap(new Map(...)) which changes the Map
    // reference but keeps the same data object references. An identity
    // check would see the same object and skip the upload, leaving the
    // GPU with stale Y positions while labels show the updated ones —
    // causing features and labels to become permanently misaligned.
    //
    // This effect only fires when rpcDataMap changes reference (on
    // fetch completion or relayout), not on every scroll tick, so
    // always re-uploading is safe and correct.
    for (const [regionNumber, data] of rpcDataMap) {
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
    renderer.pruneStaleRegions([...rpcDataMap.keys()])

    setHoveredFeature(null)
    setHoveredSubfeature(null)
    model.setFeatureIdUnderMouse(null)

    renderWithBlocks()
  }, [model, rpcDataMap, rendererReady])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      return
    }

    let rafId = 0
    const scheduleRender = () => {
      if (rafId === 0) {
        rafId = requestAnimationFrame(() => {
          rafId = 0
          renderWithBlocks()
        })
      }
    }

    const handleWheel = (e: WheelEvent) => {
      if (model.hasOverflow) {
        if (view.scrollZoom && !e.shiftKey) {
          e.preventDefault()
        } else {
          e.stopPropagation()
        }
      }
    }

    container.addEventListener('scroll', scheduleRender, { passive: true })
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('scroll', scheduleRender)
      container.removeEventListener('wheel', handleWheel)
      if (rafId !== 0) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [model, view])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const hitTestAtEvent = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const yPos = mouseY + (scrollContainerRef.current?.scrollTop ?? 0)
      return performMultiRegionHitDetection(
        flatbushCacheMapRef.current,
        model.rpcDataMap,
        view.visibleRegions,
        mouseX,
        yPos,
        model.effectiveShowDescriptions,
      )
    }

    const clearHoverState = () => {
      model.setMouseoverExtraInformation(undefined)
      setHoveredFeature(null)
      setHoveredSubfeature(null)
      model.setFeatureIdUnderMouse(null)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (contextMenuCoord) {
        return
      }
      setClientXY([e.clientX, e.clientY])
      if (model.rpcDataMap.size === 0) {
        clearHoverState()
        return
      }

      const result = hitTestAtEvent(e)

      if (result.feature) {
        if (result.subfeature) {
          model.setMouseoverExtraInformation(
            result.subfeature.tooltip ?? result.subfeature.type,
          )
          setHoveredSubfeature(result.subfeature)
        } else {
          model.setMouseoverExtraInformation(result.feature.tooltip)
          setHoveredSubfeature(null)
        }
        setHoveredFeature(result.feature)
        model.setFeatureIdUnderMouse(result.feature.featureId)
      } else {
        clearHoverState()
      }
    }

    const handleClick = (e: MouseEvent) => {
      if (model.rpcDataMap.size === 0) {
        return
      }
      const result = hitTestAtEvent(e)
      if (result.feature) {
        model.selectFeatureById(
          result.feature,
          result.subfeature ?? undefined,
          result.regionNumber,
        )
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (model.rpcDataMap.size === 0) {
        return
      }
      const result = hitTestAtEvent(e)
      if (result.feature) {
        model.showContextMenuForFeature(result.feature, result.regionNumber)
        model.setMouseoverExtraInformation(undefined)
        setContextMenuCoord([e.clientX, e.clientY])
      }
    }

    const handleMouseLeave = () => {
      if (!contextMenuCoord) {
        clearHoverState()
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
  }, [model, contextMenuCoord])

  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions

  const featureItemMap = useMemo(() => {
    const map = new Map<
      string,
      {
        item: FlatbushItem | SubfeatureInfo
        vr: VisibleRegion
        data: FeatureDataResult | undefined
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
    const renderedLabels = new Set<string>()

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
        if (renderedLabels.has(featureId)) {
          continue
        }

        const featureStartBp = labelData.minX + regionStart
        const featureEndBp = labelData.maxX + regionStart

        if (featureEndBp < vr.start || featureStartBp > vr.end) {
          continue
        }

        renderedLabels.add(featureId)

        const featureLeftPx =
          vr.screenStartPx + (featureStartBp - vr.start) / blockBpPerPx
        const featureRightPx =
          vr.screenStartPx + (featureEndBp - vr.start) / blockBpPerPx

        const featureWidth = featureRightPx - featureLeftPx

        const featureBottomPx = labelData.topY + labelData.featureHeight

        const emitLabel = (
          label: {
            text: string
            relativeY: number
            color: string
            textWidth: number
            isOverlay?: boolean
          },
          padding: number,
          key: string,
        ) => {
          const labelY = featureBottomPx + label.relativeY + padding
          const labelX =
            label.textWidth > featureWidth
              ? featureLeftPx
              : Math.min(
                  Math.max(Math.max(vr.screenStartPx, featureLeftPx), 0),
                  featureRightPx - label.textWidth,
                )

          elements.push(
            <div
              key={`${vr.regionNumber}-${featureId}-${key}`}
              style={{
                position: 'absolute',
                transform: `translate(${labelX}px, ${labelY}px)`,
                fontSize: 11,
                lineHeight: 1,
                color: label.color,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                ...(label.isOverlay
                  ? { background: 'rgba(255,255,255,0.65)' }
                  : undefined),
              }}
            >
              {label.text}
            </div>,
          )
        }

        if (labelData.nameLabel && model.showLabels) {
          emitLabel(labelData.nameLabel, 2, 'name')
        }
        if (labelData.descriptionLabel && model.effectiveShowDescriptions) {
          emitLabel(labelData.descriptionLabel, 2, 'desc')
        }
        if (labelData.subfeatureLabel) {
          emitLabel(labelData.subfeatureLabel, 0, 'sub')
        }
      }
    }

    return elements.length > 0 ? elements : null
  }, [
    rpcDataMap,
    view,
    width,
    bpPerPx,
    visibleRegions,
    model.showLabels,
    model.effectiveShowDescriptions,
  ])

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
      const leftPx = Math.max(
        vr.screenStartPx,
        vr.screenStartPx + (item.startBp - vr.start) / blockBpPerPx,
      )
      const rightPx = Math.min(
        vr.screenEndPx,
        vr.screenStartPx + (item.endBp - vr.start) / blockBpPerPx,
      )
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
      refName: string,
      style: React.CSSProperties,
      key: string,
      extraWidth = 0,
      padding = 0,
    ) => {
      for (const vr of visibleRegions) {
        if (vr.refName !== refName) {
          continue
        }
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
      data: FeatureDataResult | undefined,
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
      return computeLabelExtraWidth(
        labelData,
        featureWidthPx,
        model.effectiveShowDescriptions,
      )
    }

    const hoverItem = hoveredSubfeature ?? hoveredFeature
    if (hoverItem) {
      const featureId = hoveredSubfeature
        ? hoveredSubfeature.featureId
        : hoveredFeature!.featureId
      const result = findItemForId(featureId)
      if (result) {
        let hoverExtraWidth = 0
        if (hoveredFeature && !hoveredSubfeature && result.data) {
          hoverExtraWidth = computeExtraWidth(
            hoveredFeature.featureId,
            hoverItem,
            result.vr,
            result.data,
          )
        }
        addOverlay(
          hoverItem,
          result.vr.refName,
          { backgroundColor: 'rgba(0, 0, 0, 0.15)' },
          'hover',
          hoverExtraWidth,
        )
      }
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
          result.vr.refName,
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
    view,
    width,
    bpPerPx,
    visibleRegions,
    hoveredFeature,
    hoveredSubfeature,
    model.selectedFeatureId,
    model.effectiveShowDescriptions,
  ])

  if (model.regionTooLarge) {
    return <TooLargeMessage model={model} />
  }

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width ?? '100%'}
        height={height}
        onRetry={() => {
          model.reload()
        }}
      />
    )
  }

  const isReady = view.initialized

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
      }}
    >
      <div
        ref={scrollContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: model.hasOverflow ? 'auto' : 'hidden',
          overflowX: 'hidden',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: model.hasOverflow ? model.maxY : '100%',
            minHeight: '100%',
          }}
        >
          <canvas
            ref={canvasCallbackRef}
            style={{
              display: 'block',
              width,
              height,
              position: 'sticky',
              top: 0,
              cursor: hoveredFeature ? 'pointer' : 'default',
            }}
          />

          {[
            highlightOverlays,
            floatingLabelElements,
            aminoAcidOverlayElements,
          ].map((elements, i) =>
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
                }}
              >
                {elements}
              </div>
            ) : null,
          )}
        </div>
      </div>

      {model.hasOverflow || model.heightBeforeExpand !== undefined ? (
        <OverflowIndicator
          expanded={model.heightBeforeExpand !== undefined}
          showScrollHint={view.scrollZoom && model.hasOverflow}
          onExpand={() => {
            model.expandToFit()
          }}
          onRestore={() => {
            model.collapseFromExpand()
          }}
        />
      ) : null}

      <LoadingOverlay
        statusMessage={
          debouncedLoading
            ? model.statusMessage || 'Loading features'
            : 'Initializing'
        }
        isVisible={debouncedLoading || !isReady}
      />
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
            setHoveredFeature(null)
            setHoveredSubfeature(null)
            model.setFeatureIdUnderMouse(null)
            model.setMouseoverExtraInformation(undefined)
          }}
        />
      ) : null}
    </div>
  )
})

export default FeatureComponent
