import { useSyncExternalStore } from 'react'

function subscribeToResize(cb: () => void) {
  window.addEventListener('resize', cb)
  return () => {
    window.removeEventListener('resize', cb)
  }
}

export function useWindowSize() {
  const width = useSyncExternalStore(subscribeToResize, () => window.innerWidth)
  const height = useSyncExternalStore(
    subscribeToResize,
    () => window.innerHeight,
  )
  return { width, height }
}
