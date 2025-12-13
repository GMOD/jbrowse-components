import DotplotGrid from './DotplotGrid'

import type { DotplotViewModel } from '../model'

type Coord = [number, number] | undefined

interface MouseInteractionLayerProps {
  model: DotplotViewModel
  ctrlKeyDown: boolean
  cursorMode: string
  validSelect: boolean
  mousedown: Coord
  mouserect: Coord
  xdistance: number
  ydistance: number
  setMouseDownClient: (coord: Coord) => void
  setMouseCurrClient: (coord: Coord) => void
  setCtrlKeyWasUsed: (wasUsed: boolean) => void
}

export default function MouseInteractionLayer({
  model,
  ctrlKeyDown,
  cursorMode,
  validSelect,
  mousedown,
  mouserect,
  xdistance,
  ydistance,
  setMouseDownClient,
  setMouseCurrClient,
  setCtrlKeyWasUsed,
}: MouseInteractionLayerProps) {
  return (
    <div
      style={{ cursor: ctrlKeyDown ? 'pointer' : cursorMode }}
      onMouseDown={event => {
        if (event.button === 0) {
          const { clientX, clientY } = event
          setMouseDownClient([clientX, clientY])
          setMouseCurrClient([clientX, clientY])
          setCtrlKeyWasUsed(ctrlKeyDown)
        }
      }}
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
    </div>
  )
}
