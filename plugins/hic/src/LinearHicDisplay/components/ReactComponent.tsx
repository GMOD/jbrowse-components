import { useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, reducePrecision, toLocale } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
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

interface Hover {
  item: HicContactItem
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
        cursor: hover ? 'crosshair' : undefined,
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
      }}
      onMouseMove={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        const localX = event.clientX - rect.left
        const localY = event.clientY - rect.top
        const item = model.hitTest(localX, localY)
        setHover(
          item
            ? {
                item,
                clientX: event.clientX,
                clientY: event.clientY,
                localX,
                localY,
              }
            : undefined,
        )
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
          {model.rpcData ? (
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
