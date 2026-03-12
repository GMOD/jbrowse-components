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
    const observer = new ResizeObserver(entries => {
      const box = entries[0]!.contentBoxSize[0]!
      setDims({
        width: box.inlineSize,
        height: box.blockSize,
      })
    })
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, dims] as const
}
