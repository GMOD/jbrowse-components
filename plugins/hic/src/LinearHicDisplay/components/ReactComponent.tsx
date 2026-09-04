import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { reducePrecision, toLocale } from '@jbrowse/core/util'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { PointerLayer } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import HicOverlayPanel from './HicOverlayPanel.tsx'
import { HicRenderer } from './HicRenderer.ts'

import type { HicDataResult } from '../../RenderHicDataRPC/types.ts'
import type { LinearHicDisplayModel } from '../model.ts'
import type { MouseTracker } from '@jbrowse/core/ui'

function formatLocus(data: HicDataResult, regionIdx: number, bin: number) {
  const refName = data.regions[regionIdx]?.refName
  const start = bin * data.resolution
  const end = start + data.resolution
  return `${refName}:${toLocale(start + 1)}-${toLocale(end)}`
}

// Strings, not the payload the loci were read off. React's dev-only component
// performance track diffs a changed prop by walking it, and a typed array is
// walked element by element (react-dom `addObjectToProperties`), so passing
// `rpcData` here spent ~6s and ~1GB per refetch-under-the-cursor enumerating
// `instances`. Nothing reads a whole payload through a prop anymore; keep it
// that way.
function HicTooltip({
  locus1,
  locus2,
  counts,
  x,
  y,
}: {
  locus1: string
  locus2: string
  counts: number
  x: number
  y: number
}) {
  return (
    <BaseTooltip clientPoint={{ x, y }}>
      <div>{locus1}</div>
      <div>{locus2}</div>
      <div>Score: {reducePrecision(counts)}</div>
    </BaseTooltip>
  )
}

// The two contact axes meeting under the cursor, drawn back up to the top edge —
// so the guide names the pair of loci this cell is the intersection of.
//
// Deliberately NOT called `Crosshairs`, which is a different component in
// `@jbrowse/core/ui` that sibling displays (wiggle, multi-wiggle, maf) import for
// a plain vertical rule. This one is a chevron along the triangle's diagonals and
// shares nothing with it but the `currentColor` stroke; the two carrying one name
// invites a dedupe that would silently replace this geometry with a vertical line.
//
// The screen slope of a data-space diagonal is exactly `yScalar` — the squash
// lands after the rotation (see hicTransform.ts) — so reaching y=0 from the
// cursor costs `y / yScalar` in x. `viewScale` correctly does not appear: it
// scales both axes before the squash, so it cancels out of the slope.
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
      {/* currentColor so the guide tracks the UI theme's text color rather
          than a fixed black, the same way core's Crosshairs does */}
      <g stroke="currentColor" strokeWidth="1" fill="none">
        <path d={`M ${x - dx} 0 L ${x} ${y} L ${x + dx} 0`} />
      </g>
    </svg>
  )
}

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
        <HicBody
          model={model}
          canvasRef={canvasRef}
          mouseTracker={mouseTracker}
          width={width}
        />
      )}
    </DisplayChrome>
  )
})

const HicBody = observer(function HicBody({
  model,
  canvasRef,
  mouseTracker,
  width,
}: {
  model: LinearHicDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  mouseTracker: MouseTracker
  width: number
}) {
  const { height, yScalar } = model
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
      <PointerLayer mouseTracker={mouseTracker}>
        {mouseState => {
          // Derived rather than stored beside the coordinates: one measurement
          // per frame already gives the guide and the tooltip the same
          // position, so a second copy of the hit in component state could only
          // disagree with it. `item` is absent over an empty bin, where the
          // guide still draws (reading a position off the axes is exactly what
          // you want somewhere with no contact) but there is nothing to put in
          // a tooltip.
          // the global family's rule — DISPLAYCHROME.md, the pointer section
          const item =
            mouseState && !model.isLoadingOrCanceled
              ? model.hitTest(mouseState.x, mouseState.y)
              : undefined
          return mouseState ? (
            <>
              <ContactAxisGuides
                x={mouseState.x}
                y={mouseState.y}
                yScalar={yScalar}
                width={width}
                height={height}
              />
              {item && model.rpcData ? (
                <HicTooltip
                  locus1={formatLocus(
                    model.rpcData,
                    item.region1Idx,
                    item.bin1,
                  )}
                  locus2={formatLocus(
                    model.rpcData,
                    item.region2Idx,
                    item.bin2,
                  )}
                  counts={item.counts}
                  x={mouseState.clientX}
                  y={mouseState.clientY}
                />
              ) : null}
            </>
          ) : null
        }}
      </PointerLayer>
    </>
  )
})

export default LinearHicReactComponent
