import { useEffect } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { getBpDisplayStr, stringify } from '@jbrowse/core/util'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { PointerLayer } from '@jbrowse/display-ui'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import Crosshairs from './Crosshairs.tsx'
import FocalSnpHighlight from './FocalSnpHighlight.tsx'
import LDColumnZone from './LDColumnZone.tsx'
import { LDRenderer } from './LDRenderer.ts'
import LDStatusBar from './LDStatusBar.tsx'
import { ldMetricLabel, ldValueText } from './ldColorRamp.ts'

import type { LDCellHit } from '../../RenderLDDataRPC/types.ts'
import type { LDDisplayModel } from '../model.ts'
import type {
  MouseState,
  MouseTracker,
} from '@jbrowse/core/ui/useMouseTracking'

function SnpRow({ snp }: { snp: LDCellHit['snp1'] }) {
  return (
    <div>
      {snp.id ? <b>{snp.id} </b> : null}
      {stringify({ refName: snp.refName, coord: snp.start + 1 })}
      {snp.maf === undefined ? null : ` · MAF ${snp.maf.toFixed(3)}`}
    </div>
  )
}

function LDTooltip({
  item,
  x,
  y,
  ldMetric,
}: {
  item: LDCellHit
  x: number
  y: number
  ldMetric: string
}) {
  return (
    <BaseTooltip clientPoint={{ x, y }}>
      <SnpRow snp={item.snp1} />
      <SnpRow snp={item.snp2} />
      <div>
        {ldMetricLabel(ldMetric)}: {ldValueText(item.ldValue)}
      </div>
      <div>
        Distance: {getBpDisplayStr(Math.abs(item.snp1.start - item.snp2.start))}
      </div>
    </BaseTooltip>
  )
}

const LDPointer = observer(function LDPointer({
  model,
  mouseState,
}: {
  model: LDDisplayModel
  mouseState: MouseState | undefined
}) {
  const item =
    mouseState && !model.isLoadingOrCanceled
      ? model.hitTest(mouseState.x, mouseState.y)
      : undefined
  const snp1 = item?.snp1
  const snp2 = item?.snp2
  const { view } = model

  // The guides live on the view, so a pan moves them with no mousemove: the
  // autorun does its own reads, and re-arms only when the hovered pair
  // changes.
  useEffect(() => {
    const dispose = autorun(() => {
      const xJ = snp2
        ? model.locusViewportX(snp2.refName, snp2.start)
        : undefined
      const xI = snp1
        ? model.locusViewportX(snp1.refName, snp1.start)
        : undefined
      view.setVolatileGuides(
        xJ !== undefined && xI !== undefined && model.showVerticalGuides
          ? [{ xPos: xJ }, { xPos: xI }]
          : [],
      )
    })
    return () => {
      dispose()
      view.setVolatileGuides([])
    }
  }, [snp1, snp2, model, view])

  if (!item || !mouseState) {
    return null
  }
  const xJ = model.locusViewportX(item.snp2.refName, item.snp2.start)
  const xI = model.locusViewportX(item.snp1.refName, item.snp1.start)
  return (
    <>
      {xJ !== undefined && xI !== undefined ? (
        <Crosshairs model={model} hoveredItem={item} xJ={xJ} xI={xI} />
      ) : null}
      <LDTooltip
        item={item}
        x={mouseState.clientX}
        y={mouseState.clientY}
        ldMetric={model.effectiveLdMetric}
      />
    </>
  )
})

function EmptyState() {
  const palette = usePalette()
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: palette.text.secondary,
      }}
    >
      Enable LD triangle in display settings to view data
    </div>
  )
}

const LDBody = observer(function LDBody({
  model,
  canvasRef,
  mouseTracker,
}: {
  model: LDDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  mouseTracker: MouseTracker
}) {
  const { canvasWidth, matrixHeight, matrixTop } = model
  return (
    <>
      <canvas
        data-testid="ld_canvas"
        ref={canvasRef}
        style={{
          width: canvasWidth,
          height: matrixHeight,
          position: 'absolute',
          left: 0,
          top: matrixTop,
          cursor: 'crosshair',
        }}
      />
      {model.focalSnpIndex >= 0 ? <FocalSnpHighlight model={model} /> : null}
      <PointerLayer mouseTracker={mouseTracker}>
        {mouseState => <LDPointer model={model} mouseState={mouseState} />}
      </PointerLayer>
      <LDStatusBar model={model} />
      <LDColumnZone model={model} />
    </>
  )
})

const LDDisplayComponent = observer(function LDDisplayComponent({
  model,
}: {
  model: LDDisplayModel
}) {
  const { showLDTriangle, canvasWidth: width, height } = model

  return (
    <DisplayChrome
      model={model}
      factory={LDRenderer}
      testid="ld-display"
      style={{ width, height, overflow: 'hidden' }}
      onClick={event => {
        // Click a cell to make its row SNP focal, empty space to clear.
        // Hit-tested from the click, since the hover can be a frame stale.
        const rect = event.currentTarget.getBoundingClientRect()
        if (showLDTriangle && !model.isLoadingOrCanceled) {
          const item = model.hitTest(
            event.clientX - rect.left,
            event.clientY - rect.top,
          )
          model.setFocalSnp(item?.snp1)
        }
      }}
    >
      {({ canvasRef, mouseTracker }) =>
        showLDTriangle ? (
          <LDBody
            model={model}
            canvasRef={canvasRef}
            mouseTracker={mouseTracker}
          />
        ) : (
          <EmptyState />
        )
      }
    </DisplayChrome>
  )
})

export default LDDisplayComponent
