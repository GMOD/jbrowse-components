import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { formatScore } from '@jbrowse/core/util/numericUtils'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { PointerLayer } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { expectedOf } from '../contactLookup.ts'
import { HicRenderer } from './HicRenderer.ts'

import type {
  HicContactItem,
  HicDataResult,
} from '../../RenderHicDataRPC/types.ts'
import type { LinearHicDisplayModel } from '../model.ts'
import type { MouseState } from '@jbrowse/core/ui/useMouseTracking'

function formatLocus(data: HicDataResult, regionIdx: number, bin: number) {
  const refName = data.regions[regionIdx]?.refName
  const start = bin * data.binSize
  return `${refName}:${toLocale(start + 1)}-${toLocale(start + data.binSize)}`
}

// The two contact axes meeting under the cursor, drawn up to the diagonal. A
// diagonal's screen slope is `yScalar`, so reaching y=0 costs `y / yScalar`.
// Not core's `Crosshairs`, which is a vertical rule.
const ContactAxisGuides = observer(function ContactAxisGuides({
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
})

// Strings in, never the payload: React's dev performance track walks a typed
// array prop element by element.
const HicTooltip = observer(function HicTooltip({
  locus1,
  locus2,
  rows,
  x,
  y,
}: {
  locus1: string
  locus2: string
  rows: readonly (readonly [string, string])[]
  x: number
  y: number
}) {
  return (
    <BaseTooltip clientPoint={{ x, y }}>
      <div>{locus1}</div>
      <div>{locus2}</div>
      {rows.map(([label, value]) => (
        <div key={label}>
          {label}: {value}
        </div>
      ))}
    </BaseTooltip>
  )
})

// A ratio is read with its two operands beside it, so speckle over a tiny
// count can be told from signal.
function valueRows(
  model: LinearHicDisplayModel,
  data: HicDataResult,
  item: HicContactItem,
) {
  const value = [model.valueLabel, formatScore(item.value)] as const
  const expected = expectedOf(data, item)
  const { operands } = data
  return operands
    ? [
        value,
        ['Observed', formatScore(operands.observed[item.index]!)] as const,
        ['Control', formatScore(operands.control[item.index]!)] as const,
      ]
    : expected === undefined
      ? [value]
      : [
          value,
          ['Observed', formatScore(item.value * expected)] as const,
          ['Expected', formatScore(expected)] as const,
        ]
}

const HicPointer = observer(function HicPointer({
  model,
  mouseState,
}: {
  model: LinearHicDisplayModel
  mouseState: MouseState
}) {
  const { rpcData, canvasWidth, height, yScalar, hoveredFeature: item } = model
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
          rows={valueRows(model, rpcData, item)}
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
      style={{ cursor: 'crosshair', width, overflow: 'hidden' }}
      onPointerPosition={state => {
        model.setPointer(state)
      }}
    >
      {({ canvasRef, mouseTracker }) => (
        <>
          <canvas
            data-testid="hic_canvas"
            ref={canvasRef}
            style={{ width, height, position: 'absolute', left: 0 }}
          />
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
