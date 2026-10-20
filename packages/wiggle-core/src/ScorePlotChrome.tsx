import { useMemo } from 'react'

import { eventPoint } from '@jbrowse/core/util/eventPoint'
import BottomRightIndicators from '@jbrowse/display-kit/BottomRightIndicators'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import {
  isContextMenuHost,
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

export interface ScorePlotContextMenuHost<ContextHit> {
  contextMenuInfo?: ContextMenuAnchor
  contextMenuItems: () => MenuItem[]
  closeContextMenu: () => void
  openContextMenu: (info: ContextMenuAnchor & { hit: ContextHit }) => void
}

function isScorePlotMenuHost<ContextHit>(
  model: object,
): model is ScorePlotContextMenuHost<ContextHit> {
  return isContextMenuHost(model) && 'openContextMenu' in model
}

export type ScorePlotChromeModel<
  Hit,
  TRegion,
  TState extends FrameDimensions,
> = ChromeModel &
  RenderLifecycleModel<PerRegionRenderingBackend<TRegion, TState>> & {
    canvasWidthPx: number
    scrollableHeight: number
    setHoveredFeature: (hit?: Hit) => void
    selectFeature: (hit: Hit) => void
  }

/**
 * The on-screen chrome of a display drawing a mark list on a score axis: the
 * canvas in the axis plot box, hover and click resolved through `findHit`, the
 * pointer-following `tooltip`, and the right-click menu where the model
 * composes `ContextMenuMixin`. `findHit` takes y from the plot's own top.
 * `findContextHit` is for a display whose menu is about something other than
 * the hovered record (the wiggle's column, which exists where no bin does).
 */
export const ScorePlotChrome = observer(function ScorePlotChrome<
  Hit,
  TRegion,
  TState extends FrameDimensions,
  ContextHit = Hit,
>({
  model,
  marks,
  testid,
  plotGeometry,
  findHit,
  findContextHit,
  tooltip,
  overlay,
  indicators,
}: {
  model: ScorePlotChromeModel<Hit, TRegion, TState>
  marks: readonly Mark<TRegion, TState>[]
  testid: string
  plotGeometry?: PlotBox
  findHit: (x: number, y: number) => Hit | undefined
  findContextHit?: (x: number, y: number) => ContextHit | undefined
  tooltip: (mouseState: MouseState | undefined) => ReactNode
  overlay?: (plotGeometry: PlotBox) => ReactNode
  indicators?: () => ReactNode
}) {
  const { height, canvasWidthPx: width } = model
  const box = plotGeometry ?? axisPlotBox(height)
  const factory = useMemo(
    () => (canvas: HTMLCanvasElement) => createMarkBackend(canvas, marks),
    [marks],
  )
  const hitAt = (x: number, y: number) => findHit(x, y - box.yTop)
  const contextMenu = isScorePlotMenuHost<ContextHit>(model) ? model : undefined
  return (
    <DisplayChrome
      model={model}
      factory={factory}
      testid={testid}
      style={{ width, whiteSpace: 'nowrap', textAlign: 'left' }}
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
              const hit = findContextHit
                ? findContextHit(x, y - box.yTop)
                : (hitAt(x, y) as ContextHit | undefined)
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
          model={model}
          canvasRef={canvasRef}
          mouseTracker={mouseTracker}
          width={width}
          plotGeometry={box}
          tooltip={tooltip}
          overlay={overlay}
          indicators={indicators}
        />
      )}
    </DisplayChrome>
  )
})

const ScorePlotBody = observer(function ScorePlotBody({
  model,
  canvasRef,
  mouseTracker,
  width,
  plotGeometry,
  tooltip,
  overlay,
  indicators,
}: {
  model: { scrollableHeight: number }
  canvasRef: (node: HTMLCanvasElement | null) => void
  mouseTracker: MouseTracker
  width: number
  plotGeometry: PlotBox
  tooltip: (mouseState: MouseState | undefined) => ReactNode
  overlay?: (plotGeometry: PlotBox) => ReactNode
  indicators?: () => ReactNode
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
        <BottomRightIndicators scrollableHeight={model.scrollableHeight}>
          {indicators()}
        </BottomRightIndicators>
      ) : null}
    </>
  )
})
