import { useState } from 'react'

export function useCursorMode(cursorMode: string) {
  const [ctrlKeyWasUsed, setCtrlKeyWasUsed] = useState(false)
  const [ctrlKeyDown, setCtrlKeyDown] = useState(false)

  const validPan =
    (cursorMode === 'move' && !ctrlKeyWasUsed) ||
    (cursorMode === 'crosshair' && ctrlKeyWasUsed)

  const validSelect =
    (cursorMode === 'move' && ctrlKeyWasUsed) ||
    (cursorMode === 'crosshair' && !ctrlKeyWasUsed)

  return {
    ctrlKeyWasUsed,
    ctrlKeyDown,
    validPan,
    validSelect,
    setCtrlKeyWasUsed,
    setCtrlKeyDown,
  }
}
