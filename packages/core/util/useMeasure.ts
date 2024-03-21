import { useState, useEffect, useRef } from 'react'

export default function useMeasure() {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ width?: number; height?: number }>({
    height: undefined,
    width: undefined,
  })
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const RS =
      typeof window !== 'undefined' && 'ResizeObserver' in window
        ? window.ResizeObserver
        : undefined

    if (!RS) {
      return
    }
    const observer = new RS(entries => {
      setDims({
        height: entries[0].contentRect.height,
        width: entries[0].contentRect.width,
      })
    })
    observer.observe(ref.current)

    // Callback fired when component is unmounted
    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, dims] as const
}
