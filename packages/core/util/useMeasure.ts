import { useEffect, useRef, useState } from 'react'

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
      const entry = entries[0]
      if (entry) {
        setDims({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, dims] as const
}
