import { observer } from 'mobx-react'

import DotplotGrid from './DotplotGrid.tsx'

import type { DotplotInteraction } from './useDotplotInteraction.ts'
import type { DotplotViewModel } from '../model.ts'

const MouseInteractionLayer = observer(function MouseInteractionLayer({
  model,
  interaction,
}: {
  model: DotplotViewModel
  interaction: DotplotInteraction
}) {
  const {
    ctrlKeyDown,
    validSelect,
    mousedown,
    mouserect,
    xdistance,
    ydistance,
    setMouseDownClient,
    setMouseCurrClient,
    setCtrlKeyWasUsed,
  } = interaction
  return (
    <div
      style={{ cursor: ctrlKeyDown ? 'pointer' : model.cursorMode }}
      onMouseDown={event => {
        if (event.button === 0) {
          const { clientX, clientY } = event
          setMouseDownClient([clientX, clientY])
          setMouseCurrClient([clientX, clientY])
          setCtrlKeyWasUsed(ctrlKeyDown)
        }
      }}
    >
      <svg
        width={model.viewWidth}
        height={model.viewHeight}
        style={{ background: 'rgba(0,0,0,0.12)' }}
      >
        <DotplotGrid model={model}>
          {validSelect && mousedown && mouserect ? (
            <rect
              fill="rgba(255,0,0,0.3)"
              x={Math.min(mouserect[0], mousedown[0])}
              y={Math.min(mouserect[1], mousedown[1])}
              width={Math.abs(xdistance)}
              height={Math.abs(ydistance)}
            />
          ) : null}
        </DotplotGrid>
      </svg>
    </div>
  )
})

export default MouseInteractionLayer
