import { useId, useRef, useState } from 'react'

import { ScrollEdgeShadow, VerticalScrollbar } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { usePanelVirtualScroll } from '@jbrowse/core/util/usePanelVirtualScroll'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { PointerLayer } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { MultiWayRenderer } from '../MultiWayRenderer.ts'
import LaneHeaders from './LaneHeaders.tsx'
import MultiWayOverlay from './MultiWayOverlay.tsx'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'
import type { MouseTracker } from '@jbrowse/core/ui'

const CLICK_DRAG_THRESHOLD_PX = 5

const MultiWayBody = observer(function MultiWayBody({
  model,
  canvasRef,
  mouseTracker,
}: {
  model: MultiWaySyntenyDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
  mouseTracker: MouseTracker
}) {
  const { canvasWidth: width, height, hoverTarget } = model
  const canvasId = useId()
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)

  // The wheel rule and the zoom-on-scroll arbitration are the canvas
  // display's, shared as usePanelVirtualScroll; the panel wraps the canvas
  // and every overlay drawn over it so a wheel over a lane header is still
  // the panel's (see useVirtualScrollWheel). Inert while the stack fits the
  // track, since scrollableHeight is 0 there.
  usePanelVirtualScroll(panel, model, {
    viewportHeight: height,
    scrollZoom: model.lgv.scrollZoom,
  })

  return (
    <>
      <div
        ref={setPanel}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
      >
        <canvas
          id={canvasId}
          ref={canvasRef}
          style={{
            width,
            height,
            position: 'absolute',
            left: 0,
            top: 0,
            cursor: hoverTarget ? 'pointer' : undefined,
          }}
        />
        <MultiWayOverlay model={model} />
        <LaneHeaders model={model} />
      </div>
      <ScrollEdgeShadow
        scrollTop={model.scrollTop}
        viewportHeight={height}
        contentHeight={model.scrollContentHeight}
      />
      <VerticalScrollbar
        scrollTop={model.scrollTop}
        setScrollTop={n => {
          model.setScrollTop(n)
        }}
        viewportHeight={height}
        contentHeight={model.scrollContentHeight}
        controlsId={canvasId}
      />
      <PointerLayer mouseTracker={mouseTracker}>
        {mouse =>
          mouse && hoverTarget ? (
            <BaseTooltip clientPoint={{ x: mouse.clientX, y: mouse.clientY }}>
              <div style={{ whiteSpace: 'pre' }}>{hoverTarget.label}</div>
            </BaseTooltip>
          ) : null
        }
      </PointerLayer>
    </>
  )
})

const MultiWaySyntenyReactComponent = observer(
  function MultiWaySyntenyReactComponent({
    model,
  }: {
    model: MultiWaySyntenyDisplayModel
  }) {
    const { canvasWidth: width, height } = model
    // a pan ends with a click on whatever the drag stopped over; only a press
    // that stayed put opens what it pressed
    const pressX = useRef<number | undefined>(undefined)
    return (
      <DisplayChrome
        model={model}
        factory={MultiWayRenderer}
        testid="multiway-synteny-display"
        style={{ width, height, overflow: 'hidden' }}
        onPointerPosition={state => {
          model.setPointer(state)
        }}
        onMouseDown={event => {
          pressX.current = event.clientX
        }}
        onClick={event => {
          const pressed = pressX.current
          pressX.current = undefined
          if (
            pressed !== undefined &&
            Math.abs(event.clientX - pressed) < CLICK_DRAG_THRESHOLD_PX
          ) {
            model.selectHovered()
          }
        }}
      >
        {({ canvasRef, mouseTracker }) => (
          <MultiWayBody
            model={model}
            canvasRef={canvasRef}
            mouseTracker={mouseTracker}
          />
        )}
      </DisplayChrome>
    )
  },
)

export default MultiWaySyntenyReactComponent
