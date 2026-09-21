import { useEffect, useId, useRef, useState } from 'react'

import { ScrollChrome } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { morphClockMs } from '@jbrowse/core/util'
import { eventPoint } from '@jbrowse/core/util/eventPoint'
import { usePanelVirtualScroll } from '@jbrowse/core/util/usePanelVirtualScroll'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
import { PointerLayer } from '@jbrowse/display-ui'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { MultiWayRenderer } from '../MultiWayRenderer.ts'
import LaneHeaders from './LaneHeaders.tsx'

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

  usePanelVirtualScroll(panel, model, model.lgv.scrollZoom)

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
        <LaneHeaders model={model} />
      </div>
      <ScrollChrome model={model} controlsId={canvasId} />
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
    useEffect(() => {
      let raf = 0
      const tick = () => {
        raf = 0
        if (isAlive(model)) {
          model.tickLaneMotion(morphClockMs())
          if (model.animating) {
            raf = requestAnimationFrame(tick)
          }
        }
      }
      const dispose = autorun(() => {
        if (model.animating && raf === 0) {
          raf = requestAnimationFrame(tick)
        }
      })
      return () => {
        dispose()
        cancelAnimationFrame(raf)
        if (isAlive(model)) {
          model.endLaneMotion()
        }
      }
    }, [model])
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
            const { clientX, clientY } = event
            model.setPointer({ ...eventPoint(event), clientX, clientY })
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
