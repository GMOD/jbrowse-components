import { useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, reducePrecision } from '@jbrowse/core/util'
import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import HicOverlayPanel from './HicOverlayPanel.tsx'
import { HicRenderer } from './HicRenderer.ts'

import type { HicContactItem } from '../../RenderHicDataRPC/types.ts'
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

function HicTooltip({
  item,
  x,
  y,
}: {
  item: HicContactItem
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

const HicCanvas = observer(function HicCanvas({
  model,
  canvasRef,
}: {
  model: LinearHicDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  const view = getContainingView(model) as LGV
  const width = view.totalWidthPx
  const { height, rpcData, yScalar } = model
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
        data-testid={`hic_canvas${rpcData ? '_done' : ''}`}
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
          <HicTooltip item={hover.item} x={hover.clientX} y={hover.clientY} />
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
    <DisplayChrome model={model} factory={HicRenderer}>
      {({ canvasRef }) => <HicCanvas model={model} canvasRef={canvasRef} />}
    </DisplayChrome>
  )
})

export default LinearHicReactComponent
