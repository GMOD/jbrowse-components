import { useCallback, useMemo } from 'react'

import { eventPoint } from '@jbrowse/core/util/eventPoint'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import {
  DisplayContextMenu,
  openContextMenuFromEvent,
} from '@jbrowse/display-kit/DisplayContextMenu'
import { PointerLayer } from '@jbrowse/display-ui'
import { wiggleMouseHandlers } from '@jbrowse/plugin-wiggle'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import {
  CrossHatches,
  YScaleBarOverlay,
  axisPlotBox,
} from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { findMarkHit } from '../findMarkHit.ts'
import MarkTooltip from './MarkTooltip.tsx'

import type { MarkTooltipModel } from './MarkTooltip.tsx'
import type { MarkDisplayModel } from './markDisplayTypes.ts'
import type { MouseTracker } from '@jbrowse/core/ui'

const LinearMarkDisplayComponent = observer(
  function LinearMarkDisplayComponent({
    model,
  }: {
    model: MarkDisplayModel & MarkTooltipModel
  }) {
    const { height, canvasWidthPx: width, markList } = model
    // Keyed on the mark list, which moves only when the declared shapes do:
    // a pass list is fixed at backend construction, so a new shape list is a
    // new backend, and anything else is the stable factory the hook wants.
    const factory = useMemo(
      () => (canvas: HTMLCanvasElement) => createMarkBackend(canvas, markList),
      [markList],
    )
    const plotTop = axisPlotBox(height).yTop
    const computeHit = useCallback(
      (offsetX: number, offsetY: number) =>
        findMarkHit(
          offsetX,
          offsetY - plotTop,
          model.renderBlocks,
          model.rpcDataMap,
          model.markList,
          model.markShapes,
          model.renderState,
          model.regionRefNames,
        ),
      [model, plotTop],
    )
    const { onPointerPosition, onClick } = wiggleMouseHandlers(
      model,
      computeHit,
    )
    return (
      <DisplayChrome
        model={model}
        factory={factory}
        testid="mark-display"
        style={{ width, height, whiteSpace: 'nowrap', textAlign: 'left' }}
        onPointerPosition={onPointerPosition}
        onClick={onClick}
        onContextMenu={event => {
          const { x, y } = eventPoint(event)
          const hit = computeHit(x, y)
          openContextMenuFromEvent(
            model,
            event,
            hit
              ? { clientX: event.clientX, clientY: event.clientY, hit }
              : undefined,
          )
        }}
      >
        {({ canvasRef, mouseTracker }) => (
          <MarkBody
            model={model}
            canvasRef={canvasRef}
            width={width}
            height={height}
            mouseTracker={mouseTracker}
          />
        )}
      </DisplayChrome>
    )
  },
)

const MarkBody = observer(function MarkBody({
  model,
  canvasRef,
  width,
  height,
  mouseTracker,
}: {
  model: MarkDisplayModel & MarkTooltipModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  width: number
  height: number
  mouseTracker: MouseTracker
}) {
  const { ticks, showCrossHatches } = model
  const plotBox = axisPlotBox(height)
  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          width,
          height: plotBox.plotHeight,
          position: 'absolute',
          left: 0,
          top: plotBox.yTop,
        }}
      />
      {ticks ? (
        <YScaleBarOverlay ticks={ticks} height={height} width={width} />
      ) : null}
      {showCrossHatches && ticks ? (
        <CrossHatches ticks={ticks} width={width} height={height} />
      ) : null}
      <PointerLayer mouseTracker={mouseTracker}>
        {mouseState => <MarkTooltip model={model} mouseState={mouseState} />}
      </PointerLayer>
      <DisplayContextMenu model={model} />
    </>
  )
})

export default LinearMarkDisplayComponent
