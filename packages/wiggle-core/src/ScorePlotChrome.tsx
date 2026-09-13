import { useMemo } from 'react'

import { eventPoint } from '@jbrowse/core/util/eventPoint'
import BottomRightIndicators from '@jbrowse/display-kit/BottomRightIndicators'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import {
  DisplayContextMenu,
  openContextMenuFromEvent,
} from '@jbrowse/display-kit/DisplayContextMenu'
import { PointerLayer, axisPlotBox } from '@jbrowse/display-ui'
import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { observer } from 'mobx-react'

import type {
  ContextMenuAnchor,
  MenuItem,
  MouseState,
  MouseTracker,
} from '@jbrowse/core/ui'
import type { ChromeModel } from '@jbrowse/display-kit/DisplayChrome'
import type { Mark } from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { FrameDimensions } from '@jbrowse/render-core/renderingBackendBase'
import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'
import type { ReactNode } from 'react'

interface PlotBox {
  yTop: number
  plotHeight: number
}

interface ContextMenuView {
  contextMenuInfo?: ContextMenuAnchor
  contextMenuItems: () => MenuItem[]
  closeContextMenu: () => void
}

export interface ScorePlotContextMenuHost<Hit> extends ContextMenuView {
  openContextMenu: (info: ContextMenuAnchor & { hit: Hit }) => void
  clearHoveredFeature: () => void
}

export type ScorePlotChromeModel<
  Hit,
  TRegion,
  TState extends FrameDimensions,
> = ChromeModel &
  RenderLifecycleModel<PerRegionRenderingBackend<TRegion, TState>> & {
    canvasWidthPx: number
    setHoveredFeature: (hit?: Hit) => void
    selectFeature: (hit: Hit) => void
  }

/**
 * The on-screen chrome of a display drawing a mark list on a score axis: the
 * canvas in the axis plot box, hover and click resolved through `findHit`, the
 * pointer-following `tooltip`, and the right-click menu where `contextMenu`
 * names the model that owns it. `findHit` takes y from the plot's own top.
 */
export const ScorePlotChrome = observer(function ScorePlotChrome<
  Hit,
  TRegion,
  TState extends FrameDimensions,
>({
  model,
  marks,
  testid,
  plotGeometry,
  findHit,
  tooltip,
  overlay,
  indicators,
  contextMenu,
}: {
  model: ScorePlotChromeModel<Hit, TRegion, TState>
  marks: readonly Mark<TRegion, TState>[]
  testid: string
  plotGeometry?: PlotBox
  findHit: (x: number, y: number) => Hit | undefined
  tooltip: (mouseState: MouseState | undefined) => ReactNode
  overlay?: (plotGeometry: PlotBox) => ReactNode
  indicators?: () => ReactNode
  contextMenu?: ScorePlotContextMenuHost<Hit>
}) {
  const { height, canvasWidthPx: width } = model
  const box = plotGeometry ?? axisPlotBox(height)
  const factory = useMemo(
    () => (canvas: HTMLCanvasElement) => createMarkBackend(canvas, marks),
    [marks],
  )
  const hitAt = (x: number, y: number) => findHit(x, y - box.yTop)
  return (
    <DisplayChrome
      model={model}
      factory={factory}
      testid={testid}
      style={{ width, height, whiteSpace: 'nowrap', textAlign: 'left' }}
      onPointerPosition={state => {
        model.setHoveredFeature(state ? hitAt(state.x, state.y) : undefined)
      }}
      onClick={event => {
        const { x, y } = eventPoint(event)
        const hit = hitAt(x, y)
        if (hit) {
          model.selectFeature(hit)
        }
      }}
      onContextMenu={
        contextMenu
          ? event => {
              const { x, y } = eventPoint(event)
              const hit = hitAt(x, y)
              openContextMenuFromEvent(
                contextMenu,
                event,
                hit
                  ? { clientX: event.clientX, clientY: event.clientY, hit }
                  : undefined,
              )
            }
          : undefined
      }
    >
      {({ canvasRef, mouseTracker }) => (
        <ScorePlotBody
          canvasRef={canvasRef}
          mouseTracker={mouseTracker}
          width={width}
          plotGeometry={box}
          tooltip={tooltip}
          overlay={overlay}
          indicators={indicators}
          contextMenu={contextMenu}
        />
      )}
    </DisplayChrome>
  )
})

const ScorePlotBody = observer(function ScorePlotBody({
  canvasRef,
  mouseTracker,
  width,
  plotGeometry,
  tooltip,
  overlay,
  indicators,
  contextMenu,
}: {
  canvasRef: (node: HTMLCanvasElement | null) => void
  mouseTracker: MouseTracker
  width: number
  plotGeometry: PlotBox
  tooltip: (mouseState: MouseState | undefined) => ReactNode
  overlay?: (plotGeometry: PlotBox) => ReactNode
  indicators?: () => ReactNode
  contextMenu?: ContextMenuView
}) {
  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          width,
          height: plotGeometry.plotHeight,
          position: 'absolute',
          left: 0,
          top: plotGeometry.yTop,
        }}
      />
      {overlay?.(plotGeometry)}
      <PointerLayer mouseTracker={mouseTracker}>{tooltip}</PointerLayer>
      {indicators ? (
        <BottomRightIndicators>{indicators()}</BottomRightIndicators>
      ) : null}
      {contextMenu ? <DisplayContextMenu model={contextMenu} /> : null}
    </>
  )
})
