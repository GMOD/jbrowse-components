import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'

import { CanvasDisplayWrapper, ErrorOverlay } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import {
  getContainingView,
  reducePrecision,
  useGpuRenderer,
  useTabVisibilityRerender,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import HicColorLegend from './HicColorLegend.tsx'
import { HicRenderer, generateColorRamp } from './HicRenderer.ts'

import type { HicFlatbushItem } from '../../RenderHicDataRPC/types.ts'
import type { LinearHicDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const SQRT2 = Math.SQRT2

function HicTooltip({
  item,
  x,
  y,
}: {
  item: HicFlatbushItem
  x: number
  y: number
}) {
  return (
    <BaseTooltip clientPoint={{ x: x + 15, y }}>
      <div>Score: {reducePrecision(item.counts)}</div>
    </BaseTooltip>
  )
}

function Crosshairs({
  x,
  y,
  yScalar,
  width,
  height,
}: {
  x: number
  y: number
  yScalar: number
  width: number
  height: number
}) {
  const dx = y / yScalar
  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      <g stroke="#000" strokeWidth="1" fill="none">
        <path d={`M ${x - dx} 0 L ${x} ${y} L ${x + dx} 0`} />
      </g>
    </svg>
  )
}

function screenToUnrotated(
  screenX: number,
  screenY: number,
  yScalar: number,
): { x: number; y: number } {
  const scaledY = screenY / yScalar
  const x = (screenX - scaledY) / SQRT2
  const y = (screenX + scaledY) / SQRT2
  return { x, y }
}

const HicCanvas = observer(function HicCanvas({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const view = getContainingView(model) as LGV
  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const {
    height,
    rpcData,
    flatbush,
    flatbushItems,
    yScalar,
    showLegend,
    maxScore,
    colorScheme,
    useLogScale,
    lastDrawnOffsetPx,
    lastDrawnBpPerPx,
  } = model

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredItem, setHoveredItem] = useState<HicFlatbushItem>()
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
  }>()
  const [localMousePos, setLocalMousePos] = useState<{
    x: number
    y: number
  }>()

  const { error, ready, rendererRef, retry } = useGpuRenderer(
    canvasRef,
    HicRenderer,
  )

  const renderNow = useEffectEvent(() => {
    const renderer = rendererRef.current
    const data = model.rpcData
    if (!renderer || !data) {
      return
    }
    const w = Math.round(view.dynamicBlocks.totalWidthPx)
    const scale =
      model.lastDrawnBpPerPx !== undefined
        ? model.lastDrawnBpPerPx / view.bpPerPx
        : 1
    const offsetX =
      model.lastDrawnOffsetPx !== undefined
        ? model.lastDrawnOffsetPx * scale - view.offsetPx
        : 0
    renderer.render({
      binWidth: data.binWidth,
      yScalar: data.yScalar,
      canvasWidth: w,
      canvasHeight: model.height,
      maxScore: data.maxScore,
      useLogScale: model.useLogScale,
      viewScale: scale,
      viewOffsetX: offsetX,
    })
  })

  // Compute view transform for smooth zoom/scroll
  const viewScale =
    lastDrawnBpPerPx !== undefined ? lastDrawnBpPerPx / view.bpPerPx : 1
  const viewOffsetX =
    lastDrawnOffsetPx !== undefined
      ? lastDrawnOffsetPx * viewScale - view.offsetPx
      : 0

  const flatbushIndex = useMemo(
    () => (flatbush ? Flatbush.from(flatbush) : null),
    [flatbush],
  )

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer || !ready) {
      return
    }

    let lastRpcData: unknown = null
    let lastColorScheme: string | undefined

    return autorun(() => {
      const data = model.rpcData
      if (!data) {
        return
      }

      if (lastRpcData !== data) {
        lastRpcData = data
        renderer.uploadData({
          positions: data.positions,
          counts: data.counts,
          numContacts: data.numContacts,
        })
      }

      if (lastColorScheme !== model.colorScheme) {
        lastColorScheme = model.colorScheme
        renderer.uploadColorRamp(generateColorRamp(model.colorScheme))
      }

      // SYNC across all hook-driven GPU displays (wiggle, multi-wiggle,
      // variants, alignments, HiC, LD): dataVersion is a counter incremented
      // by setLoadedRegionForRegion() after each region's data is committed.
      // Reading it here creates a MobX dependency so this autorun re-fires at
      // that point, ensuring renderNow() runs with fully-committed data.
      // See MultiRegionDisplayMixin.withFetchLifecycle.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _dv = model.dataVersion

      renderNow()
      model.setCanvasDrawn(true)
    })
  }, [model, view, ready, rendererRef])

  useTabVisibilityRerender(renderNow)

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!containerRef.current || !flatbushIndex || !flatbushItems.length) {
        setHoveredItem(undefined)
        setMousePosition(undefined)
        return
      }

      const rect = containerRef.current.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top

      setMousePosition({ x: event.clientX, y: event.clientY })
      setLocalMousePos({ x: mouseX, y: mouseY })

      // Reverse the shader transform to get data-space screen coordinates
      const dataScreenX = (mouseX - viewOffsetX) / viewScale
      const dataScreenY = mouseY / viewScale

      const { x, y } = screenToUnrotated(dataScreenX, dataScreenY, yScalar)

      const results = flatbushIndex.search(x - 1, y - 1, x + 1, y + 1)

      if (results.length > 0) {
        const item = flatbushItems[results[0]!]
        setHoveredItem(item)
      } else {
        setHoveredItem(undefined)
      }
    },
    [flatbushIndex, flatbushItems, yScalar, viewScale, viewOffsetX],
  )

  const onMouseLeave = useCallback(() => {
    setHoveredItem(undefined)
    setMousePosition(undefined)
    setLocalMousePos(undefined)
  }, [])

  if (error) {
    return (
      <ErrorOverlay
        error={error}
        width={width}
        height={height}
        onRetry={() => {
          retry()
        }}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        cursor: hoveredItem && mousePosition ? 'crosshair' : undefined,
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <canvas
        data-testid={`hic_canvas${rpcData ? '_done' : ''}`}
        ref={canvasRef}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
        }}
      />
      {hoveredItem && localMousePos ? (
        <Crosshairs
          x={localMousePos.x}
          y={localMousePos.y}
          yScalar={yScalar}
          width={width}
          height={height}
        />
      ) : null}

      {hoveredItem && mousePosition ? (
        <HicTooltip
          item={hoveredItem}
          x={mousePosition.x}
          y={mousePosition.y}
        />
      ) : null}
      {showLegend && maxScore > 0 ? (
        <HicColorLegend
          maxScore={maxScore}
          colorScheme={colorScheme}
          useLogScale={useLogScale}
        />
      ) : null}
    </div>
  )
})

const LinearHicReactComponent = observer(function LinearHicReactComponent({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  return (
    <CanvasDisplayWrapper model={model}>
      <HicCanvas model={model} />
    </CanvasDisplayWrapper>
  )
})

export default LinearHicReactComponent
