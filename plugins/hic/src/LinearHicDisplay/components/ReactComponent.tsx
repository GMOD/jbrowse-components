import { useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import {
  getContainingView,
  reducePrecision,
  toLocale,
} from '@jbrowse/core/util'
import { BlockMsg, DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import HicOverlayPanel from './HicOverlayPanel.tsx'
import { HicRenderer } from './HicRenderer.ts'

import type {
  HicContactItem,
  HicDataResult,
} from '../../RenderHicDataRPC/types.ts'
import type { LinearHicDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// `item` is absent over an empty bin, where the guide still draws (reading a
// position off the axes is exactly what you want somewhere with no contact) but
// there is nothing to put in a tooltip.
interface Hover {
  item: HicContactItem | undefined
  clientX: number
  clientY: number
  localX: number
  localY: number
}

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
  item: HicContactItem
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

// A .hic file legitimately has no contacts for many region pairs at a given
// binsize (HicAdapter returns [] for those), which otherwise paints an empty
// track indistinguishable from one still fetching.
function EmptyMessage() {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    >
      <BlockMsg
        severity="info"
        message="No contacts in this region at this resolution"
      />
    </div>
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

const HicCanvas = observer(function HicCanvas({
  model,
  canvasRef,
}: {
  model: LinearHicDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const view = getContainingView(model) as LGV
  const width = view.totalWidthPx
  const { height, yScalar } = model
  const [hover, setHover] = useState<Hover>()

  return (
    <div
      style={{
        cursor: 'crosshair',
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
      }}
      onMouseMove={event => {
        // The overlay panel (resolution dropdown, legend) is portaled out of
        // this div, so its React events still bubble here even though its DOM
        // node isn't a descendant. Suppress the guide/tooltip while over it.
        const { target } = event
        if (target instanceof Node && event.currentTarget.contains(target)) {
          const rect = event.currentTarget.getBoundingClientRect()
          const localX = event.clientX - rect.left
          const localY = event.clientY - rect.top
          setHover({
            item: model.hitTest(localX, localY),
            clientX: event.clientX,
            clientY: event.clientY,
            localX,
            localY,
          })
        } else {
          setHover(undefined)
        }
      }}
      onMouseLeave={() => {
        setHover(undefined)
      }}
    >
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
      {model.isEmpty ? <EmptyMessage /> : null}
      <HicOverlayPanel model={model} />
      {hover ? (
        <>
          <Crosshairs
            x={hover.localX}
            y={hover.localY}
            yScalar={yScalar}
            width={width}
            height={height}
          />
          {hover.item && model.rpcData ? (
            <HicTooltip
              item={hover.item}
              data={model.rpcData}
              x={hover.clientX}
              y={hover.clientY}
            />
          ) : null}
        </>
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
    <DisplayChrome model={model} factory={HicRenderer} testid="hic-display">
      {({ canvasRef }) => <HicCanvas model={model} canvasRef={canvasRef} />}
    </DisplayChrome>
  )
})

export default LinearHicReactComponent
