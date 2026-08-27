import { useRef } from 'react'

import { useMouseState } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import DisplayChrome from '@jbrowse/display-kit/DisplayChrome'
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
  const mouse = useMouseState(mouseTracker)
  const { canvasWidth: width, height, hoverTarget } = model
  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ width, height, position: 'absolute', left: 0, top: 0 }}
      />
      <MultiWayOverlay model={model} />
      <LaneHeaders model={model} />
      {mouse && hoverTarget ? (
        <BaseTooltip clientPoint={{ x: mouse.clientX, y: mouse.clientY }}>
          <div style={{ whiteSpace: 'pre' }}>{hoverTarget.label}</div>
        </BaseTooltip>
      ) : null}
    </>
  )
})

const MultiWaySyntenyReactComponent = observer(
  function MultiWaySyntenyReactComponent({
    model,
  }: {
    model: MultiWaySyntenyDisplayModel
  }) {
    const { canvasWidth: width, height, hoverTarget } = model
    // a pan ends with a click on whatever the drag stopped over; only a press
    // that stayed put opens what it pressed
    const pressX = useRef<number | undefined>(undefined)
    return (
      <DisplayChrome
        model={model}
        factory={MultiWayRenderer}
        testid="multiway-synteny-display"
        style={{
          width,
          height,
          overflow: 'hidden',
          cursor: hoverTarget ? 'pointer' : undefined,
        }}
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
