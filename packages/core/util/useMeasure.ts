import { useState, useEffect, useRef } from 'react'

export default function useMeasure() {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ width?: number; height?: number }>({
    width: undefined,
    height: undefined,
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
        width: entries[0]!.contentRect.width,
        height: entries[0]!.contentRect.height,
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
