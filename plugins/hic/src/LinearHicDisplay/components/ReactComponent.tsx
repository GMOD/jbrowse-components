import { useRef } from 'react'

import { useMouseTracking } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { reducePrecision, toLocale } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import HicOverlayPanel from './HicOverlayPanel.tsx'
import { HicRenderer } from './HicRenderer.ts'

import type { HicDataResult } from '../../RenderHicDataRPC/types.ts'
import type { LinearHicDisplayModel } from '../model.ts'
import type { MouseState } from '@jbrowse/core/ui'

function formatLocus(data: HicDataResult, regionIdx: number, bin: number) {
  const refName = data.regionRefNames[regionIdx]
  const start = bin * data.resolution
  const end = start + data.resolution
  return `${refName}:${toLocale(start + 1)}-${toLocale(end)}`
}

function HicTooltip({
  item,
  data,
  x,
  y,
}: {
  item: NonNullable<ReturnType<LinearHicDisplayModel['hitTest']>>
  data: HicDataResult
  x: number
  y: number
}) {
  return (
    <BaseTooltip clientPoint={{ x: x + 15, y }}>
      <div>{formatLocus(data, item.region1Idx, item.bin1)}</div>
      <div>{formatLocus(data, item.region2Idx, item.bin2)}</div>
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
      {/* currentColor matches the shared core Crosshairs component, so the
          guide tracks the UI theme's text color rather than a fixed black */}
      <g stroke="currentColor" strokeWidth="1" fill="none">
        <path d={`M ${x - dx} 0 L ${x} ${y} L ${x + dx} 0`} />
      </g>
    </svg>
  )
}

// Thin outer: owns the chrome and the pointer measurement bound to its
// container. There is no inner positioning div — the chrome already IS the
// `position:relative` box its own overlays need (DisplayStatusChromeBase), so
// sizing it here rather than nesting a second identically-sized container is
// what lets `mouseState` be measured against the same element the canvas fills.
const LinearHicReactComponent = observer(function LinearHicReactComponent({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const { height, lgv } = model
  const width = lgv.totalWidthPx
  const ref = useRef<HTMLDivElement>(null)
  const { mouseState, handleMouseMove, handleMouseLeave } =
    useMouseTracking(ref)

  return (
    <DisplayChrome
      model={model}
      factory={HicRenderer}
      ref={ref}
      testid="hic-display"
      style={{ cursor: 'crosshair', width, height, overflow: 'hidden' }}
      onMouseMove={event => {
        // The overlay panel (resolution dropdown, legend) is portaled out of
        // this container, so its React events still bubble here even though its
        // DOM node isn't a descendant. Suppress the guide/tooltip while over it.
        const { target } = event
        if (target instanceof Node && event.currentTarget.contains(target)) {
          handleMouseMove(event)
        } else {
          handleMouseLeave()
        }
      }}
      onMouseLeave={handleMouseLeave}
    >
      {({ canvasRef }) => (
        <HicBody
          model={model}
          canvasRef={canvasRef}
          mouseState={mouseState}
          width={width}
        />
      )}
    </DisplayChrome>
  )
})

const HicBody = observer(function HicBody({
  model,
  canvasRef,
  mouseState,
  width,
}: {
  model: LinearHicDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  mouseState?: MouseState
  width: number
}) {
  const { height, yScalar } = model
  // Derived rather than stored beside the coordinates: one measurement per
  // frame already gives the guide and the tooltip the same position, so a
  // second copy of the hit in component state could only disagree with it.
  // `item` is absent over an empty bin, where the guide still draws (reading a
  // position off the axes is exactly what you want somewhere with no contact)
  // but there is nothing to put in a tooltip.
  const item = mouseState
    ? model.hitTest(mouseState.x, mouseState.y)
    : undefined

  return (
    <>
      <canvas
        data-testid="hic_canvas"
        ref={canvasRef}
        style={{
          width,
          height,
          position: 'absolute',
          left: 0,
        }}
      />
      <HicOverlayPanel model={model} />
      {mouseState ? (
        <>
          <Crosshairs
            x={mouseState.x}
            y={mouseState.y}
            yScalar={yScalar}
            width={width}
            height={height}
          />
          {item && model.rpcData ? (
            <HicTooltip
              item={item}
              data={model.rpcData}
              x={mouseState.clientX}
              y={mouseState.clientY}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
})

export default LinearHicReactComponent
