import { useCallback, useLayoutEffect, useRef } from 'react'

export function useEvent<A extends unknown[], R>(
  handler: (...args: A) => R,
): (...args: A) => R {
  const handlerRef = useRef(handler)

  useLayoutEffect(() => {
    handlerRef.current = handler
  })

  return useCallback((...args: A) => handlerRef.current(...args), [])
}
