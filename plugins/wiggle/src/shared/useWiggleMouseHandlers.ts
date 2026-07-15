import { useCallback, useRef, useState } from 'react'

const COORD0: [number, number] = [0, 0]

interface MouseTrackingModel<T> {
  featureUnderMouse?: T
  setFeatureUnderMouse: (feat?: T) => void
  selectFeature: (feat: T) => void
}

// Shared pointer plumbing for the wiggle-family display components: tracks the
// client/offset cursor coords for the tooltip and routes hit-testing through
// the caller's `computeHit`. Single- and multi-wiggle differ only in how a hit
// is resolved (one source vs row/overlay), so that stays a callback.
export function useWiggleMouseHandlers<T>(
  model: MouseTrackingModel<T>,
  computeHit: (offsetX: number, offsetY: number) => T | undefined,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [clientMouseCoord, setClientMouseCoord] = useState(COORD0)
  const [offsetMouseCoord, setOffsetMouseCoord] = useState(COORD0)

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const container = containerRef.current
      if (container) {
        const rect = container.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top
        setClientMouseCoord([event.clientX, event.clientY])
        setOffsetMouseCoord([offsetX, offsetY])
        model.setFeatureUnderMouse(computeHit(offsetX, offsetY))
      }
    },
    [model, computeHit],
  )

  const handleMouseLeave = useCallback(() => {
    model.setFeatureUnderMouse(undefined)
  }, [model])

  const handleClick = useCallback(() => {
    const feat = model.featureUnderMouse
    if (feat) {
      model.selectFeature(feat)
    }
  }, [model])

  return {
    containerRef,
    clientMouseCoord,
    offsetMouseCoord,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  }
}
