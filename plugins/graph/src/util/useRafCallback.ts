import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

function useRafCallback(callback: () => void) {
  const rafRef = useRef<number | null>(null)
  const callbackRef = useRef(callback)
  useLayoutEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return useCallback(() => {
    if (rafRef.current !== null) {
      return
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      callbackRef.current()
    })
  }, [])
}

export default useRafCallback
