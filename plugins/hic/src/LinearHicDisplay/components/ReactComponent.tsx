import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { formatScore } from '@jbrowse/core/util/numericUtils'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { PointerLayer } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import HicOverlayPanel from './HicOverlayPanel.tsx'
import { HicRenderer } from './HicRenderer.ts'

import type { HicDataResult } from '../../RenderHicDataRPC/types.ts'
import type { LinearHicDisplayModel } from '../model.ts'
import type { MouseState } from '@jbrowse/core/ui/useMouseTracking'

function formatLocus(data: HicDataResult, regionIdx: number, bin: number) {
  const refName = data.regions[regionIdx]?.refName
  const start = bin * data.resolution
  return `${refName}:${toLocale(start + 1)}-${toLocale(start + data.resolution)}`
}

// The two contact axes meeting under the cursor, drawn up to the diagonal. A
// diagonal's screen slope is `yScalar`, so reaching y=0 costs `y / yScalar`.
// Not core's `Crosshairs`, which is a vertical rule.
function ContactAxisGuides({
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
      <path
        d={`M ${x - dx} 0 L ${x} ${y} L ${x + dx} 0`}
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  )
}

// Strings in, never the payload: React's dev performance track walks a typed
// array prop element by element.
function HicTooltip({
  locus1,
  locus2,
  label,
  value,
  x,
  y,
}: {
  locus1: string
  locus2: string
  label: string
  value: string
  x: number
  y: number
}) {
  return (
    <BaseTooltip clientPoint={{ x, y }}>
      <div>{locus1}</div>
      <div>{locus2}</div>
      <div>
        {label}: {value}
      </div>
    </BaseTooltip>
  )
}

const HicPointer = observer(function HicPointer({
  model,
  mouseState,
}: {
  model: LinearHicDisplayModel
  mouseState: MouseState
}) {
  const { rpcData, canvasWidth, height, yScalar } = model
  const item = model.isLoadingOrCanceled
    ? undefined
    : model.hitTest(mouseState.x, mouseState.y)
  return (
    <>
      <ContactAxisGuides
        x={mouseState.x}
        y={mouseState.y}
        yScalar={yScalar}
        width={canvasWidth}
        height={height}
      />
      {item && rpcData ? (
        <HicTooltip
          locus1={formatLocus(rpcData, item.region1Idx, item.bin1)}
          locus2={formatLocus(rpcData, item.region2Idx, item.bin2)}
          label={model.valueLabel}
          value={formatScore(item.counts)}
          x={mouseState.clientX}
          y={mouseState.clientY}
        />
      ) : null}
    </>
  )
})

const LinearHicReactComponent = observer(function LinearHicReactComponent({
  model,
}: {
  model: LinearHicDisplayModel
}) {
  const { height, canvasWidth: width } = model
  return (
    <DisplayChrome
      model={model}
      factory={HicRenderer}
      testid="hic-display"
      style={{ cursor: 'crosshair', width, height, overflow: 'hidden' }}
    >
      {({ canvasRef, mouseTracker }) => (
        <>
          <canvas
            data-testid="hic_canvas"
            ref={canvasRef}
            style={{ width, height, position: 'absolute', left: 0 }}
          />
          <HicOverlayPanel model={model} />
          <PointerLayer mouseTracker={mouseTracker}>
            {mouseState =>
              mouseState ? (
                <HicPointer model={model} mouseState={mouseState} />
              ) : null
            }
          </PointerLayer>
        </>
      )}
    </DisplayChrome>
  )
})

export default LinearHicReactComponent
