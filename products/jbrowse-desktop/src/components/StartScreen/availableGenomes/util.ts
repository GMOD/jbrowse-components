import { useSyncExternalStore } from 'react'

function subscribeResize(cb: () => void) {
  window.addEventListener('resize', cb)
  return () => {
    window.removeEventListener('resize', cb)
  }
}

const getWindowHeight = () => window.innerHeight

export function useInnerDims() {
  const height = useSyncExternalStore(
    subscribeResize,
    getWindowHeight,
    getWindowHeight,
  )
  return { height }
}
