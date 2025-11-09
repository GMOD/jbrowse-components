import { useEffect } from 'react'

export function useCtrlKeyTracking(setCtrlKeyDown: (isDown: boolean) => void) {
  useEffect(() => {
    function globalCtrlKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey) {
        setCtrlKeyDown(true)
      }
    }
    function globalCtrlKeyUp(event: KeyboardEvent) {
      if (!event.metaKey && !event.ctrlKey) {
        setCtrlKeyDown(false)
      }
    }
    window.addEventListener('keydown', globalCtrlKeyDown)
    window.addEventListener('keyup', globalCtrlKeyUp)
    return () => {
      window.removeEventListener('keydown', globalCtrlKeyDown)
      window.removeEventListener('keyup', globalCtrlKeyUp)
    }
  }, [setCtrlKeyDown])
}
